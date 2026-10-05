CREATE TABLE public.fulfillment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  intake_id UUID NOT NULL UNIQUE REFERENCES public.intakes(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('revamp','scratch','bundle')),
  email TEXT NOT NULL,
  template TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  source_text TEXT NOT NULL,
  job_text TEXT,
  source_sha256 TEXT NOT NULL,
  photo TEXT,
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment','queued','processing','needs_information','ready','failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  retry_rounds INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  clarification_request JSONB,
  clarifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  failure_reason TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
);
GRANT ALL ON public.fulfillment_orders TO service_role;
ALTER TABLE public.fulfillment_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX fulfillment_orders_due_idx ON public.fulfillment_orders (status, locked_until);

-- Intake snapshot is immutable once written; clarifications are append-only.
CREATE OR REPLACE FUNCTION public.fulfillment_orders_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.source_text IS DISTINCT FROM OLD.source_text
     OR NEW.job_text IS DISTINCT FROM OLD.job_text OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.email IS DISTINCT FROM OLD.email OR NEW.intake_id IS DISTINCT FROM OLD.intake_id
     OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256 OR NEW.template IS DISTINCT FROM OLD.template THEN
    RAISE EXCEPTION 'order snapshot is immutable';
  END IF;
  IF OLD.stripe_session_id IS NOT NULL AND NEW.stripe_session_id IS DISTINCT FROM OLD.stripe_session_id THEN
    RAISE EXCEPTION 'checkout session link is immutable';
  END IF;
  IF jsonb_array_length(NEW.clarifications) < jsonb_array_length(OLD.clarifications)
     OR NOT (NEW.clarifications @> OLD.clarifications) THEN
    RAISE EXCEPTION 'clarifications are append-only';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER fulfillment_orders_guard BEFORE UPDATE ON public.fulfillment_orders
FOR EACH ROW EXECUTE FUNCTION public.fulfillment_orders_guard();

-- Atomic claim with a lease: only one worker processes an order at a time.
CREATE OR REPLACE FUNCTION public.claim_fulfillment(_order_id UUID, _lease_seconds INT DEFAULT 240)
RETURNS SETOF public.fulfillment_orders LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.fulfillment_orders
     SET status = 'processing', attempts = attempts + 1,
         locked_until = now() + make_interval(secs => _lease_seconds)
   WHERE id = _order_id
     AND paid_at IS NOT NULL
     AND attempts < max_attempts
     AND (status = 'queued' OR (status = 'processing' AND locked_until < now()))
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_fulfillment(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_fulfillment(UUID, INT) TO service_role;

-- Orders whose lease expired after exhausting attempts become failed (retryable by customer).
CREATE OR REPLACE FUNCTION public.due_fulfillments(_limit INT DEFAULT 3)
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.fulfillment_orders
   WHERE paid_at IS NOT NULL AND attempts < max_attempts
     AND (status = 'queued' OR (status = 'processing' AND locked_until < now()))
   ORDER BY updated_at LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.due_fulfillments(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_fulfillments(INT) TO service_role;

CREATE TABLE public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;