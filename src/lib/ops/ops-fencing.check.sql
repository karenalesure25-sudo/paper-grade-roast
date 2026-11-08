-- SQL fencing checks for the outage breaker and owner alerts. Run against a throwaway database
-- that has the ops migrations applied (see ops-fencing.sql.test.ts). Raises on any failure.
DO $$
DECLARE t1 text; t2 text; s text; ok boolean; inc1 text; inc2 text;
BEGIN
  DELETE FROM public.ops_state;

  -- Trip, then cooldown: no probe yet.
  PERFORM public.ai_breaker_trip('credits_exhausted', 900);
  IF public.ai_breaker_state() <> 'open' THEN RAISE EXCEPTION 'state during cooldown should be open'; END IF;
  IF public.ai_breaker_acquire_probe(180) IS NOT NULL THEN RAISE EXCEPTION 'probe granted during cooldown'; END IF;

  -- Cooldown elapsed: exactly one probe.
  UPDATE public.ops_state SET data = data || jsonb_build_object('retryAt', now() - interval '1 second') WHERE key = 'ai_breaker';
  IF public.ai_breaker_state() <> 'probe_ready' THEN RAISE EXCEPTION 'expected probe_ready'; END IF;
  t1 := public.ai_breaker_acquire_probe(180);
  IF t1 IS NULL THEN RAISE EXCEPTION 'probe not granted'; END IF;
  IF public.ai_breaker_acquire_probe(180) IS NOT NULL THEN RAISE EXCEPTION 'second concurrent probe granted'; END IF;

  -- A non-owner (wrong/absent token) can never close.
  IF public.ai_breaker_close_probe(NULL) THEN RAISE EXCEPTION 'null token closed breaker'; END IF;
  IF public.ai_breaker_close_probe(gen_random_uuid()::text) THEN RAISE EXCEPTION 'foreign token closed breaker'; END IF;

  -- A newer outage supersedes the probe: the old owner's success must not erase it.
  PERFORM public.ai_breaker_trip('credits_exhausted', 900);
  IF public.ai_breaker_close_probe(t1) THEN RAISE EXCEPTION 'stale probe erased newer outage'; END IF;
  SELECT data->>'state' INTO s FROM public.ops_state WHERE key = 'ai_breaker';
  IF s <> 'open' THEN RAISE EXCEPTION 'breaker should still be open'; END IF;

  -- Expired probe lease cannot close.
  UPDATE public.ops_state SET data = data || jsonb_build_object('retryAt', now() - interval '1 second') WHERE key = 'ai_breaker';
  t2 := public.ai_breaker_acquire_probe(180);
  UPDATE public.ops_state SET data = data || jsonb_build_object('probeUntil', now() - interval '1 second') WHERE key = 'ai_breaker';
  IF public.ai_breaker_close_probe(t2) THEN RAISE EXCEPTION 'expired probe closed breaker'; END IF;

  -- Release frees the slot; the live owner closes.
  t2 := public.ai_breaker_acquire_probe(180);
  IF NOT public.ai_breaker_release_probe(t2) THEN RAISE EXCEPTION 'release failed'; END IF;
  t2 := public.ai_breaker_acquire_probe(180);
  IF t2 IS NULL THEN RAISE EXCEPTION 'probe not re-granted after release'; END IF;
  IF NOT public.ai_breaker_close_probe(t2) THEN RAISE EXCEPTION 'owner probe failed to close'; END IF;
  IF public.ai_breaker_state() <> 'closed' THEN RAISE EXCEPTION 'expected closed'; END IF;

  -- Alerts: stable incident id across claims; raise_once never re-raises.
  IF NOT public.ops_alert_raise('gateway-outage', 'x', 21600) THEN RAISE EXCEPTION 'raise failed'; END IF;
  SELECT incident INTO inc1 FROM public.ops_alerts_due_v2(10) WHERE key = 'gateway-outage';
  t1 := public.ops_alert_claim('gateway-outage', 120);
  PERFORM public.ops_alert_finish('gateway-outage', t1, jsonb_build_object('attempts', 1, 'lastCode', 'x'));
  SELECT incident INTO inc2 FROM public.ops_alerts_due_v2(10) WHERE key = 'gateway-outage';
  IF inc1 IS NULL OR inc1 <> inc2 THEN RAISE EXCEPTION 'incident id changed across retry'; END IF;
  -- Stale claim token cannot finish.
  t2 := public.ops_alert_claim('gateway-outage', 120);
  IF public.ops_alert_finish('gateway-outage', t1, '{"pending":false}'::jsonb) THEN RAISE EXCEPTION 'stale alert claim finished'; END IF;

  IF NOT public.ops_alert_raise_once('order-failed-a-r0', 'y') THEN RAISE EXCEPTION 'raise_once failed'; END IF;
  t1 := public.ops_alert_claim('order-failed-a-r0', 120);
  PERFORM public.ops_alert_finish('order-failed-a-r0', t1, '{"pending":false}'::jsonb);
  IF public.ops_alert_raise_once('order-failed-a-r0', 'y') THEN RAISE EXCEPTION 'raise_once re-raised a sent incident'; END IF;

  RAISE NOTICE 'ops fencing checks passed';
END $$;
