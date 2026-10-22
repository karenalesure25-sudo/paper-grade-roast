ALTER TABLE public.order_revisions ADD COLUMN IF NOT EXISTS base_revision_id uuid REFERENCES public.order_revisions(id);
ALTER TABLE public.order_revisions ADD COLUMN IF NOT EXISTS base_version int NOT NULL DEFAULT 1;
COMMENT ON COLUMN public.order_revisions.base_revision_id IS 'Delivered package this request edits: NULL = original (version 1), else the ready revision it builds on.';

-- Latest delivered package for an order: (revision id or NULL for original, version).
CREATE OR REPLACE FUNCTION public.latest_revision_base(_order_id uuid, OUT base_id uuid, OUT base_version int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT id FROM public.order_revisions WHERE order_id = _order_id AND status = 'ready' AND version IS NOT NULL ORDER BY version DESC LIMIT 1),
         coalesce((SELECT max(version) FROM public.order_revisions WHERE order_id = _order_id AND status = 'ready'), 1);
$$;

CREATE OR REPLACE FUNCTION public.request_order_revision(_order_id uuid, _kind text, _text text, _idem text, _deadline timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.fulfillment_orders; r public.order_revisions; total int; corrections int; b record;
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
  SELECT * INTO b FROM public.latest_revision_base(_order_id);
  INSERT INTO public.order_revisions(order_id, kind, request_text, idempotency_key, deadline_at, base_revision_id, base_version)
  VALUES (_order_id, _kind, _text, _idem, _deadline, b.base_id, b.base_version) RETURNING * INTO r;
  RETURN jsonb_build_object('outcome','created','id', r.id);
END $$;

-- Atomic retry of a failed request. Same order lock as reservation; rebases onto the latest delivered package.
CREATE OR REPLACE FUNCTION public.retry_order_revision(_id uuid, _max_rounds int DEFAULT 2)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.order_revisions; o public.fulfillment_orders; b record;
BEGIN
  SELECT * INTO r FROM public.order_revisions WHERE id = _id;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','not_found'); END IF;
  SELECT * INTO o FROM public.fulfillment_orders WHERE id = r.order_id FOR UPDATE;
  SELECT * INTO r FROM public.order_revisions WHERE id = _id FOR UPDATE;
  IF r.status <> 'failed' THEN RETURN jsonb_build_object('outcome','not_failed'); END IF;
  IF o.status <> 'ready' OR o.expires_at <= now() THEN RETURN jsonb_build_object('outcome','expired'); END IF;
  IF r.retry_rounds >= _max_rounds THEN RETURN jsonb_build_object('outcome','limit'); END IF;
  IF EXISTS (SELECT 1 FROM public.order_revisions WHERE order_id = r.order_id AND id <> r.id AND status IN ('queued','processing','needs_information')) THEN
    RETURN jsonb_build_object('outcome','pending');
  END IF;
  IF r.kind = 'minor' AND EXISTS (SELECT 1 FROM public.order_revisions WHERE order_id = r.order_id AND kind = 'minor' AND status = 'ready') THEN
    RETURN jsonb_build_object('outcome','already_used');
  END IF;
  SELECT * INTO b FROM public.latest_revision_base(r.order_id);
  UPDATE public.order_revisions SET status = 'queued', attempts = 0, retry_rounds = retry_rounds + 1, failure_reason = null,
         base_revision_id = b.base_id, base_version = b.base_version
   WHERE id = _id;
  RETURN jsonb_build_object('outcome','queued');
END $$;

-- Stale settle fenced by lease id AND expiry, evaluated atomically in one UPDATE.
CREATE OR REPLACE FUNCTION public.settle_stale_revision(_id uuid, _lease uuid, _reason text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.order_revisions SET status = 'failed', lease_id = null, locked_until = null, failure_reason = _reason
     WHERE id = _id AND status = 'processing' AND lease_id = _lease AND locked_until < now() AND attempts >= max_attempts
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;

-- Defense in depth: a minor request can't be queued/claimed while an included minor is already ready.
CREATE OR REPLACE FUNCTION public.claim_revision(_id uuid, _lease_seconds int DEFAULT 600)
RETURNS SETOF public.order_revisions LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.order_revisions r
     SET status = 'processing', attempts = attempts + 1, lease_id = gen_random_uuid(),
         locked_until = now() + make_interval(secs => _lease_seconds)
   WHERE r.id = _id AND r.attempts < r.max_attempts
     AND (r.status = 'queued' OR (r.status = 'processing' AND r.locked_until < now()))
     AND EXISTS (SELECT 1 FROM public.fulfillment_orders o WHERE o.id = r.order_id AND o.status = 'ready' AND o.expires_at > now())
     AND NOT (r.kind = 'minor' AND EXISTS (SELECT 1 FROM public.order_revisions m WHERE m.order_id = r.order_id AND m.kind = 'minor' AND m.status = 'ready' AND m.id <> r.id))
  RETURNING r.*;
$$;

REVOKE ALL ON FUNCTION public.latest_revision_base(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_order_revision(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_stale_revision(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.latest_revision_base(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_order_revision(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_stale_revision(uuid, uuid, text) TO service_role;