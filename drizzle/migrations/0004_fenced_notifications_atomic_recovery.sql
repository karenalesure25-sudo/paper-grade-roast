CREATE OR REPLACE FUNCTION public.claim_notification_fenced(_order_id uuid, _kind text, _lease_seconds integer DEFAULT 120)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tok text := gen_random_uuid()::text;
BEGIN
  UPDATE public.fulfillment_orders
     SET notifications = jsonb_set(notifications, ARRAY[_kind],
           coalesce(notifications->_kind, '{}'::jsonb) || jsonb_build_object(
             'claimedUntil', now() + make_interval(secs => _lease_seconds), 'claimToken', _tok))
   WHERE id = _order_id AND expires_at > now()
     AND coalesce((notifications->_kind->>'done')::boolean, false) = false
     AND coalesce((notifications->_kind->>'attempts')::int, 0) < 6
     AND coalesce((notifications->_kind->>'nextAt')::timestamptz, '-infinity') <= now()
     AND coalesce((notifications->_kind->>'claimedUntil')::timestamptz, '-infinity') < now();
  IF FOUND THEN RETURN _tok; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.finish_notification_fenced(_order_id uuid, _kind text, _token text, _patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.fulfillment_orders
     SET notifications = jsonb_set(notifications, ARRAY[_kind],
           (coalesce(notifications->_kind, '{}'::jsonb) - 'claimedUntil' - 'claimToken') || (_patch - 'claimedUntil' - 'claimToken'))
   WHERE id = _order_id AND _token IS NOT NULL AND notifications->_kind->>'claimToken' = _token;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.claim_notification_fenced(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_notification_fenced(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_fenced(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_notification_fenced(uuid, text, text, jsonb) TO service_role;

-- Unfenced versions are retired: revoke so no caller can clear a newer claim.
REVOKE EXECUTE ON FUNCTION public.claim_notification(uuid, text, integer) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.finish_notification(uuid, text, jsonb) FROM service_role;
COMMENT ON FUNCTION public.claim_notification(uuid, text, integer) IS 'DEPRECATED: replaced by claim_notification_fenced';
COMMENT ON FUNCTION public.finish_notification(uuid, text, jsonb) IS 'DEPRECATED: replaced by finish_notification_fenced';

CREATE INDEX IF NOT EXISTS recovery_requests_ip_idx ON public.recovery_requests(ip_hash, created_at);

-- Atomic rate-limit admission: serialize per email hash then per IP hash (fixed order, no deadlock cycle).
CREATE OR REPLACE FUNCTION public.admit_recovery_request(_email_hash text, _ip_hash text, _per_email integer, _per_ip integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('recovery-email:' || _email_hash, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('recovery-ip:' || _ip_hash, 0));
  IF (SELECT count(*) FROM public.recovery_requests WHERE email_hash = _email_hash AND created_at > now() - interval '1 hour') >= _per_email
     OR (SELECT count(*) FROM public.recovery_requests WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour') >= _per_ip THEN
    RETURN false;
  END IF;
  INSERT INTO public.recovery_requests(email_hash, ip_hash) VALUES (_email_hash, _ip_hash);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admit_recovery_request(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_recovery_request(text, text, integer, integer) TO service_role;