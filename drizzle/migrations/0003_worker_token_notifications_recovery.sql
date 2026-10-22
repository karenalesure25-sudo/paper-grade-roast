
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.worker_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.worker_tokens FROM PUBLIC, anon, authenticated;
INSERT INTO private.worker_tokens(name, token)
VALUES ('fulfillment', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_worker_token(_name text, _token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.worker_tokens
     WHERE name = _name AND length(coalesce(_token, '')) = 64
       AND extensions.digest(token, 'sha256') = extensions.digest(_token, 'sha256'));
$$;
REVOKE ALL ON FUNCTION public.verify_worker_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_worker_token(text, text) TO service_role;

-- Per-order customer notification ledger: { kind: { done, attempts, nextAt, claimedUntil, lastCode } }
ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS notifications jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.claim_notification(_order_id uuid, _kind text, _lease_seconds integer DEFAULT 120)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.fulfillment_orders
       SET notifications = jsonb_set(notifications, ARRAY[_kind],
             coalesce(notifications->_kind, '{}'::jsonb) || jsonb_build_object('claimedUntil', now() + make_interval(secs => _lease_seconds)))
     WHERE id = _order_id AND expires_at > now()
       AND coalesce((notifications->_kind->>'done')::boolean, false) = false
       AND coalesce((notifications->_kind->>'attempts')::int, 0) < 6
       AND coalesce((notifications->_kind->>'nextAt')::timestamptz, '-infinity') <= now()
       AND coalesce((notifications->_kind->>'claimedUntil')::timestamptz, '-infinity') < now()
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;

CREATE OR REPLACE FUNCTION public.finish_notification(_order_id uuid, _kind text, _patch jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.fulfillment_orders
     SET notifications = jsonb_set(notifications, ARRAY[_kind],
           (coalesce(notifications->_kind, '{}'::jsonb) - 'claimedUntil') || _patch)
   WHERE id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.due_notifications(_limit integer DEFAULT 10)
RETURNS TABLE(order_id uuid, kind text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, k FROM public.fulfillment_orders o
  CROSS JOIN LATERAL (VALUES ('confirmation'), ('ready')) v(k)
   WHERE o.paid_at IS NOT NULL AND o.expires_at > now() AND o.is_test = false
     AND (v.k = 'confirmation' OR o.status = 'ready')
     AND coalesce((o.notifications->v.k->>'done')::boolean, false) = false
     AND coalesce((o.notifications->v.k->>'attempts')::int, 0) < 6
     AND coalesce((o.notifications->v.k->>'nextAt')::timestamptz, '-infinity') <= now()
     AND coalesce((o.notifications->v.k->>'claimedUntil')::timestamptz, '-infinity') < now()
   ORDER BY o.updated_at LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.claim_notification(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_notification(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.due_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_notification(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.due_notifications(integer) TO service_role;

-- Lost-link recovery rate limiting (hashed identifiers only, no raw email/IP).
CREATE TABLE IF NOT EXISTS public.recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recovery_requests TO service_role;
ALTER TABLE public.recovery_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS recovery_requests_email_idx ON public.recovery_requests(email_hash, created_at);
CREATE INDEX IF NOT EXISTS recovery_requests_ip_idx ON public.recovery_requests(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS fulfillment_orders_email_idx ON public.fulfillment_orders(lower(email));

CREATE OR REPLACE FUNCTION public.purge_expired_fulfillments()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE n INT;
BEGIN
  DELETE FROM public.fulfillment_orders
   WHERE expires_at < now()
      OR (status = 'awaiting_payment' AND paid_at IS NULL AND created_at < now() - interval '3 days');
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.stripe_events WHERE received_at < now() - interval '90 days';
  DELETE FROM public.recovery_requests WHERE created_at < now() - interval '2 days';
  RETURN n;
END $function$;
