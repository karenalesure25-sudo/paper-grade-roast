-- Delivery timestamp: when validated files first became available. Immutable once set.
ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
UPDATE public.fulfillment_orders
   SET delivered_at = coalesce((result->>'validatedAt')::timestamptz, updated_at)
 WHERE status = 'ready' AND result IS NOT NULL AND delivered_at IS NULL;

CREATE OR REPLACE FUNCTION public.fulfillment_delivered_at_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.delivered_at IS NOT NULL AND NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'delivered_at is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fulfillment_delivered_at_guard ON public.fulfillment_orders;
CREATE TRIGGER fulfillment_delivered_at_guard BEFORE UPDATE ON public.fulfillment_orders
FOR EACH ROW EXECUTE FUNCTION public.fulfillment_delivered_at_guard();

CREATE TABLE IF NOT EXISTS public.order_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.fulfillment_orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('minor','correction')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','needs_information','ready','failed','rejected')),
  request_text text NOT NULL CHECK (char_length(request_text) BETWEEN 10 AND 1500),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 80),
  clarifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  clarification_request text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  retry_rounds int NOT NULL DEFAULT 0,
  lease_id uuid,
  locked_until timestamptz,
  result jsonb,
  version int,
  failure_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, idempotency_key)
);
GRANT ALL ON public.order_revisions TO service_role;
ALTER TABLE public.order_revisions ENABLE ROW LEVEL SECURITY;
-- One open revision at a time; at most one completed included minor revision.
CREATE UNIQUE INDEX IF NOT EXISTS order_revisions_one_open ON public.order_revisions(order_id)
  WHERE status IN ('queued','processing','needs_information');
CREATE UNIQUE INDEX IF NOT EXISTS order_revisions_one_minor ON public.order_revisions(order_id)
  WHERE kind = 'minor' AND status = 'ready';
CREATE UNIQUE INDEX IF NOT EXISTS order_revisions_version ON public.order_revisions(order_id, version) WHERE version IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_revisions_due ON public.order_revisions(status, locked_until);

CREATE OR REPLACE FUNCTION public.order_revisions_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.request_text IS DISTINCT FROM OLD.request_text OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
    RAISE EXCEPTION 'revision request is immutable';
  END IF;
  IF OLD.status = 'ready' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.result IS DISTINCT FROM OLD.result) THEN
    RAISE EXCEPTION 'completed revision is immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER order_revisions_touch BEFORE UPDATE ON public.order_revisions
FOR EACH ROW EXECUTE FUNCTION public.order_revisions_touch();

-- End of the included-minor-revision window: end of the 7th Central calendar day after delivery.
CREATE OR REPLACE FUNCTION public.minor_revision_window_end(_delivered timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (((_delivered AT TIME ZONE 'America/Chicago')::date + 8)::timestamp) AT TIME ZONE 'America/Chicago';
$$;

-- Atomic reservation. Rejections insert nothing, so they never consume the included revision.
CREATE OR REPLACE FUNCTION public.request_order_revision(_order_id uuid, _kind text, _text text, _idem text, _deadline timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.fulfillment_orders; r public.order_revisions; total int; corrections int;
BEGIN
  SELECT * INTO o FROM public.fulfillment_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','not_eligible'); END IF;
  SELECT * INTO r FROM public.order_revisions WHERE order_id = _order_id AND idempotency_key = _idem;
  IF FOUND THEN RETURN jsonb_build_object('outcome','duplicate','id', r.id); END IF;
  IF o.paid_at IS NULL OR o.status <> 'ready' OR o.result IS NULL OR o.delivered_at IS NULL OR o.expires_at <= now() THEN
    RETURN jsonb_build_object('outcome','not_eligible');
  END IF;
  IF _kind NOT IN ('minor','correction') OR char_length(coalesce(_text,'')) NOT BETWEEN 10 AND 1500 THEN
    RETURN jsonb_build_object('outcome','invalid');
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_revisions WHERE order_id = _order_id AND status IN ('queued','processing','needs_information')) THEN
    RETURN jsonb_build_object('outcome','pending');
  END IF;
  SELECT count(*), count(*) FILTER (WHERE kind = 'correction') INTO total, corrections FROM public.order_revisions WHERE order_id = _order_id;
  IF total >= 6 THEN RETURN jsonb_build_object('outcome','limit'); END IF;
  IF _kind = 'minor' THEN
    IF now() >= public.minor_revision_window_end(o.delivered_at) THEN RETURN jsonb_build_object('outcome','window_closed'); END IF;
    IF EXISTS (SELECT 1 FROM public.order_revisions WHERE order_id = _order_id AND kind = 'minor' AND status = 'ready') THEN
      RETURN jsonb_build_object('outcome','already_used');
    END IF;
  ELSIF corrections >= 3 THEN
    RETURN jsonb_build_object('outcome','limit');
  END IF;
  INSERT INTO public.order_revisions(order_id, kind, request_text, idempotency_key, deadline_at)
  VALUES (_order_id, _kind, _text, _idem, _deadline) RETURNING * INTO r;
  RETURN jsonb_build_object('outcome','created','id', r.id);
END $$;

CREATE OR REPLACE FUNCTION public.claim_revision(_id uuid, _lease_seconds int DEFAULT 600)
RETURNS SETOF public.order_revisions LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.order_revisions r
     SET status = 'processing', attempts = attempts + 1, lease_id = gen_random_uuid(),
         locked_until = now() + make_interval(secs => _lease_seconds)
   WHERE r.id = _id AND r.attempts < r.max_attempts
     AND (r.status = 'queued' OR (r.status = 'processing' AND r.locked_until < now()))
     AND EXISTS (SELECT 1 FROM public.fulfillment_orders o WHERE o.id = r.order_id AND o.status = 'ready' AND o.expires_at > now())
  RETURNING r.*;
$$;

CREATE OR REPLACE FUNCTION public.due_revisions(_limit int DEFAULT 2)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id FROM public.order_revisions r JOIN public.fulfillment_orders o ON o.id = r.order_id
   WHERE r.attempts < r.max_attempts AND o.expires_at > now() AND o.is_test = false
     AND (r.status = 'queued' OR (r.status = 'processing' AND r.locked_until < now()))
   ORDER BY r.requested_at LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.due_revision_notifications(_limit int DEFAULT 10)
RETURNS TABLE(order_id uuid, kind text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, 'revision:' || r.id::text FROM public.order_revisions r JOIN public.fulfillment_orders o ON o.id = r.order_id
   WHERE r.status = 'ready' AND o.expires_at > now() AND o.is_test = false
     AND coalesce((o.notifications->('revision:' || r.id::text)->>'done')::boolean, false) = false
     AND coalesce((o.notifications->('revision:' || r.id::text)->>'attempts')::int, 0) < 6
     AND coalesce((o.notifications->('revision:' || r.id::text)->>'nextAt')::timestamptz, '-infinity') <= now()
     AND coalesce((o.notifications->('revision:' || r.id::text)->>'claimedUntil')::timestamptz, '-infinity') < now()
   ORDER BY r.completed_at LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.request_order_revision(uuid, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_revision(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.due_revisions(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.due_revision_notifications(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_revision(uuid, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_revision(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.due_revisions(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.due_revision_notifications(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.minor_revision_window_end(timestamptz) TO service_role;