CREATE TABLE public.ops_state (
  key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ops_state TO service_role;
ALTER TABLE public.ops_state ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- Known-outage circuit breaker for the generation gateway (shared by free roast + paid worker).
CREATE OR REPLACE FUNCTION public.ai_breaker_trip(_code text, _cooldown_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _was text;
BEGIN
  SELECT data->>'state' INTO _was FROM public.ops_state WHERE key = 'ai_breaker' FOR UPDATE;
  INSERT INTO public.ops_state(key, data, updated_at)
  VALUES ('ai_breaker', jsonb_build_object('state','open','code',left(_code,40),'openedAt',now(),
          'retryAt', now() + make_interval(secs => _cooldown_seconds)), now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now(), data = jsonb_build_object(
    'state','open','code',left(_code,40),
    'openedAt', CASE WHEN ops_state.data->>'state' = 'open' THEN ops_state.data->'openedAt' ELSE to_jsonb(now()) END,
    'retryAt', now() + make_interval(secs => _cooldown_seconds));
  RETURN coalesce(_was, 'closed') <> 'open';
END $$;

-- 'closed' | 'probe' (this caller may make one test request) | 'open'
CREATE OR REPLACE FUNCTION public.ai_breaker_gate(_probe_lease_seconds integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d jsonb;
BEGIN
  SELECT data INTO _d FROM public.ops_state WHERE key = 'ai_breaker' FOR UPDATE;
  IF _d IS NULL OR coalesce(_d->>'state','closed') <> 'open' THEN RETURN 'closed'; END IF;
  IF (_d->>'retryAt')::timestamptz > now() THEN RETURN 'open'; END IF;
  IF coalesce((_d->>'probeUntil')::timestamptz, '-infinity') > now() THEN RETURN 'open'; END IF;
  UPDATE public.ops_state SET data = _d || jsonb_build_object('probeUntil', now() + make_interval(secs => _probe_lease_seconds)), updated_at = now()
   WHERE key = 'ai_breaker';
  RETURN 'probe';
END $$;

CREATE OR REPLACE FUNCTION public.ai_breaker_close()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.ops_state SET data = jsonb_build_object('state','closed','closedAt',now()), updated_at = now()
   WHERE key = 'ai_breaker' AND data->>'state' = 'open'
  RETURNING true;
$$;

CREATE OR REPLACE FUNCTION public.worker_heartbeat()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.ops_state(key, data, updated_at) VALUES ('worker', jsonb_build_object('at', now()), now())
  ON CONFLICT (key) DO UPDATE SET data = jsonb_build_object('at', now()), updated_at = now();
$$;

-- Owner alerts: dedupe window per key; a raised alert stays pending until sent or exhausted.
CREATE OR REPLACE FUNCTION public.ops_alert_raise(_key text, _detail text, _dedupe_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _k text := 'alert:' || left(_key, 80); _d jsonb;
BEGIN
  SELECT data INTO _d FROM public.ops_state WHERE key = _k FOR UPDATE;
  IF _d IS NOT NULL AND (coalesce((_d->>'pending')::boolean,false)
     OR coalesce((_d->>'sentAt')::timestamptz,'-infinity') > now() - make_interval(secs => _dedupe_seconds)) THEN
    RETURN false;
  END IF;
  INSERT INTO public.ops_state(key, data, updated_at)
  VALUES (_k, jsonb_build_object('pending',true,'detail',left(_detail,500),'raisedAt',now(),'attempts',0), now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now(),
    data = coalesce(ops_state.data,'{}'::jsonb) - 'gaveUp' - 'nextAt' - 'lastCode'
           || jsonb_build_object('pending',true,'detail',left(_detail,500),'raisedAt',now(),'attempts',0);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.ops_alert_claim(_key text, _lease_seconds integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok text := gen_random_uuid()::text;
BEGIN
  UPDATE public.ops_state SET updated_at = now(),
    data = data || jsonb_build_object('claimToken', _tok, 'claimedUntil', now() + make_interval(secs => _lease_seconds))
   WHERE key = 'alert:' || _key AND coalesce((data->>'pending')::boolean,false)
     AND coalesce((data->>'nextAt')::timestamptz,'-infinity') <= now()
     AND coalesce((data->>'claimedUntil')::timestamptz,'-infinity') < now();
  IF FOUND THEN RETURN _tok; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.ops_alert_finish(_key text, _token text, _patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.ops_state SET updated_at = now(),
    data = (data - 'claimToken' - 'claimedUntil') || (_patch - 'claimToken' - 'claimedUntil')
   WHERE key = 'alert:' || _key AND _token IS NOT NULL AND data->>'claimToken' = _token;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.ops_alerts_due(_limit integer)
RETURNS TABLE(key text, detail text, attempts integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT substr(o.key, 7), o.data->>'detail', coalesce((o.data->>'attempts')::int, 0) FROM public.ops_state o
   WHERE o.key LIKE 'alert:%' AND coalesce((o.data->>'pending')::boolean,false)
     AND coalesce((o.data->>'nextAt')::timestamptz,'-infinity') <= now()
   ORDER BY o.updated_at LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.ai_breaker_trip(text,integer), public.ai_breaker_gate(integer), public.ai_breaker_close(),
  public.worker_heartbeat(), public.ops_alert_raise(text,text,integer), public.ops_alert_claim(text,integer),
  public.ops_alert_finish(text,text,jsonb), public.ops_alerts_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_breaker_trip(text,integer), public.ai_breaker_gate(integer), public.ai_breaker_close(),
  public.worker_heartbeat(), public.ops_alert_raise(text,text,integer), public.ops_alert_claim(text,integer),
  public.ops_alert_finish(text,text,jsonb), public.ops_alerts_due(integer) TO service_role;