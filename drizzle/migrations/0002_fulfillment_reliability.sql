CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.payment_redemptions DROP CONSTRAINT IF EXISTS payment_redemptions_status_check;
ALTER TABLE public.payment_redemptions ADD CONSTRAINT payment_redemptions_status_check
  CHECK (status IN ('building','delivered','failed'));

ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS lease_id UUID;
ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS checkout_attempt INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS fulfillment_orders_expires_idx ON public.fulfillment_orders (expires_at);

ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- Snapshot stays immutable. Before payment only, the layout/photo may change and an
-- EXPIRED checkout link may be replaced by a new one (expired sessions can't be paid).
CREATE OR REPLACE FUNCTION public.fulfillment_orders_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE unpaid boolean := OLD.status = 'awaiting_payment' AND OLD.paid_at IS NULL;
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.source_text IS DISTINCT FROM OLD.source_text
     OR NEW.job_text IS DISTINCT FROM OLD.job_text OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.email IS DISTINCT FROM OLD.email OR NEW.intake_id IS DISTINCT FROM OLD.intake_id
     OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256
     OR NEW.access_token IS DISTINCT FROM OLD.access_token THEN
    RAISE EXCEPTION 'order snapshot is immutable';
  END IF;
  IF NOT unpaid AND (NEW.template IS DISTINCT FROM OLD.template OR NEW.photo IS DISTINCT FROM OLD.photo) THEN
    RAISE EXCEPTION 'layout is locked after payment';
  END IF;
  IF OLD.stripe_session_id IS NOT NULL AND NEW.stripe_session_id IS DISTINCT FROM OLD.stripe_session_id
     AND NOT (unpaid AND NEW.stripe_session_id IS NOT NULL AND NEW.checkout_attempt > OLD.checkout_attempt) THEN
    RAISE EXCEPTION 'checkout session link is immutable';
  END IF;
  IF jsonb_array_length(NEW.clarifications) < jsonb_array_length(OLD.clarifications)
     OR NOT (NEW.clarifications @> OLD.clarifications) THEN
    RAISE EXCEPTION 'clarifications are append-only';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Claim now issues a fresh lease id; completion writes must present it (fencing).
CREATE OR REPLACE FUNCTION public.claim_fulfillment(_order_id UUID, _lease_seconds INT DEFAULT 240)
RETURNS SETOF public.fulfillment_orders LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.fulfillment_orders
     SET status = 'processing', attempts = attempts + 1, lease_id = gen_random_uuid(),
         locked_until = now() + make_interval(secs => _lease_seconds)
   WHERE id = _order_id
     AND paid_at IS NOT NULL
     AND expires_at > now()
     AND attempts < max_attempts
     AND (status = 'queued' OR (status = 'processing' AND locked_until < now()))
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.renew_fulfillment_lease(_order_id UUID, _lease_id UUID, _lease_seconds INT DEFAULT 600)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.fulfillment_orders
       SET locked_until = now() + make_interval(secs => _lease_seconds)
     WHERE id = _order_id AND status = 'processing' AND lease_id = _lease_id
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;
REVOKE ALL ON FUNCTION public.renew_fulfillment_lease(UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_fulfillment_lease(UUID, UUID, INT) TO service_role;

-- Dead final-attempt leases become failed (customer-retryable).
CREATE OR REPLACE FUNCTION public.settle_stale_fulfillments()
RETURNS INT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.fulfillment_orders
       SET status = 'failed', locked_until = NULL, lease_id = NULL, failure_reason = 'Processing was interrupted.'
     WHERE status = 'processing' AND attempts >= max_attempts AND locked_until < now()
    RETURNING 1)
  SELECT count(*)::int FROM u;
$$;
REVOKE ALL ON FUNCTION public.settle_stale_fulfillments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stale_fulfillments() TO service_role;

CREATE OR REPLACE FUNCTION public.due_fulfillments(_limit INT DEFAULT 3)
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.fulfillment_orders
   WHERE paid_at IS NOT NULL AND attempts < max_attempts AND expires_at > now()
     AND (status = 'queued' OR (status = 'processing' AND locked_until < now()))
   ORDER BY updated_at LIMIT _limit;
$$;

-- Retention: expired orders (and their deliverables) and old processed events are removed.
CREATE OR REPLACE FUNCTION public.purge_expired_fulfillments()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  DELETE FROM public.fulfillment_orders
   WHERE expires_at < now()
      OR (status = 'awaiting_payment' AND paid_at IS NULL AND created_at < now() - interval '3 days');
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.stripe_events WHERE received_at < now() - interval '90 days';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_expired_fulfillments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_fulfillments() TO service_role;

-- Private shared secret between the database scheduler and the worker endpoint.
CREATE TABLE IF NOT EXISTS public.worker_secrets (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.worker_secrets TO service_role;
ALTER TABLE public.worker_secrets ENABLE ROW LEVEL SECURITY;