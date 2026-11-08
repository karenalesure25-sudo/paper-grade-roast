CREATE OR REPLACE FUNCTION public.ai_breaker_state()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d jsonb;
BEGIN
  SELECT data INTO _d FROM public.ops_state WHERE key = 'ai_breaker';
  IF _d IS NULL OR coalesce(_d->>'state','closed') <> 'open' THEN RETURN 'closed'; END IF;
  IF (_d->>'retryAt')::timestamptz > now() THEN RETURN 'open'; END IF;
  IF coalesce((_d->>'probeUntil')::timestamptz, '-infinity') > now() THEN RETURN 'open'; END IF;
  RETURN 'probe_ready';
END $$;

CREATE OR REPLACE FUNCTION public.ai_breaker_acquire_probe(_lease_seconds integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d jsonb; _tok text := gen_random_uuid()::text;
BEGIN
  SELECT data INTO _d FROM public.ops_state WHERE key = 'ai_breaker' FOR UPDATE;
  IF _d IS NULL OR coalesce(_d->>'state','closed') <> 'open' THEN RETURN NULL; END IF;
  IF (_d->>'retryAt')::timestamptz > now() THEN RETURN NULL; END IF;
  IF coalesce((_d->>'probeUntil')::timestamptz, '-infinity') > now() THEN RETURN NULL; END IF;
  UPDATE public.ops_state SET updated_at = now(),
    data = _d || jsonb_build_object('probeToken', _tok, 'probeUntil', now() + make_interval(secs => _lease_seconds))
   WHERE key = 'ai_breaker';
  RETURN _tok;
END $$;

CREATE OR REPLACE FUNCTION public.ai_breaker_close_probe(_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.ops_state SET data = jsonb_build_object('state','closed','closedAt',now()), updated_at = now()
   WHERE key = 'ai_breaker' AND _token IS NOT NULL AND data->>'state' = 'open'
     AND data->>'probeToken' = _token AND (data->>'probeUntil')::timestamptz > now();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.ai_breaker_release_probe(_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.ops_state SET data = data - 'probeToken' - 'probeUntil', updated_at = now()
   WHERE key = 'ai_breaker' AND _token IS NOT NULL AND data->>'probeToken' = _token;
  RETURN FOUND;
END $$;

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
  VALUES (_k, jsonb_build_object('pending',true,'detail',left(_detail,500),'raisedAt',now(),'attempts',0,'incident',gen_random_uuid()::text), now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now(),
    data = coalesce(ops_state.data,'{}'::jsonb) - 'gaveUp' - 'nextAt' - 'lastCode' - 'sentAt' - 'outcome'
           || jsonb_build_object('pending',true,'detail',left(_detail,500),'raisedAt',now(),'attempts',0,'incident',gen_random_uuid()::text);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.ops_alert_raise_once(_key text, _detail text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.ops_state(key, data, updated_at)
  VALUES ('alert:' || left(_key, 80), jsonb_build_object('pending',true,'detail',left(_detail,500),'raisedAt',now(),'attempts',0,'incident',gen_random_uuid()::text), now())
  ON CONFLICT (key) DO NOTHING;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.ops_alerts_due_v2(_limit integer)
RETURNS TABLE(key text, detail text, attempts integer, incident text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT substr(o.key, 7), o.data->>'detail', coalesce((o.data->>'attempts')::int, 0),
         coalesce(o.data->>'incident', md5(o.key || coalesce(o.data->>'raisedAt','')))
    FROM public.ops_state o
   WHERE o.key LIKE 'alert:%' AND coalesce((o.data->>'pending')::boolean,false)
     AND coalesce((o.data->>'nextAt')::timestamptz,'-infinity') <= now()
   ORDER BY o.updated_at LIMIT _limit;
$$;

COMMENT ON FUNCTION public.ai_breaker_close() IS 'DEPRECATED: unfenced; replaced by ai_breaker_close_probe(token)';
COMMENT ON FUNCTION public.ai_breaker_gate(integer) IS 'DEPRECATED: acquired unused probes; replaced by ai_breaker_state + ai_breaker_acquire_probe';
COMMENT ON FUNCTION public.ops_alerts_due(integer) IS 'DEPRECATED: replaced by ops_alerts_due_v2 (incident id)';

REVOKE ALL ON FUNCTION public.ai_breaker_state(), public.ai_breaker_acquire_probe(integer), public.ai_breaker_close_probe(text),
  public.ai_breaker_release_probe(text), public.ops_alert_raise_once(text,text), public.ops_alerts_due_v2(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_breaker_state(), public.ai_breaker_acquire_probe(integer), public.ai_breaker_close_probe(text),
  public.ai_breaker_release_probe(text), public.ops_alert_raise_once(text,text), public.ops_alerts_due_v2(integer) TO service_role;