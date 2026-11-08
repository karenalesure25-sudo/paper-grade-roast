CREATE OR REPLACE FUNCTION public.due_followups(_limit integer DEFAULT 10)
RETURNS TABLE(order_id uuid, kind text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, 'followup:checkin'::text FROM public.fulfillment_orders o
   WHERE o.stripe_mode = 'live' AND o.paid_at IS NOT NULL AND o.status = 'ready' AND o.result IS NOT NULL
     AND o.delivered_at IS NOT NULL AND o.delivered_at + interval '12 days' <= now() AND o.expires_at > now()
     AND o.followup_opt_in AND o.followup_unsubscribed_at IS NULL
     AND coalesce((o.notifications->'followup:checkin'->>'done')::boolean, false) = false
     AND coalesce((o.notifications->'followup:checkin'->>'attempts')::int, 0) < 6
     AND coalesce((o.notifications->'followup:checkin'->>'nextAt')::timestamptz, '-infinity') <= now()
     AND coalesce((o.notifications->'followup:checkin'->>'claimedUntil')::timestamptz, '-infinity') < now()
   ORDER BY o.delivered_at LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.due_followups(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_followups(integer) TO service_role;