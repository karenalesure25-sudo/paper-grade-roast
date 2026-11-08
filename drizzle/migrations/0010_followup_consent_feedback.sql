ALTER TABLE public.fulfillment_orders
  ADD COLUMN IF NOT EXISTS followup_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pref_token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_orders_pref_token_key ON public.fulfillment_orders (pref_token);

CREATE TABLE IF NOT EXISTS public.order_feedback (
  order_id uuid PRIMARY KEY REFERENCES public.fulfillment_orders(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  share_ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_feedback TO service_role;
ALTER TABLE public.order_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.due_followups(_limit integer DEFAULT 10)
RETURNS TABLE(order_id uuid, kind text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, v.k FROM public.fulfillment_orders o
  CROSS JOIN LATERAL (VALUES ('followup:review', interval '3 days'), ('followup:interview', interval '14 days')) v(k, d)
   WHERE o.stripe_mode = 'live' AND o.paid_at IS NOT NULL AND o.status = 'ready' AND o.result IS NOT NULL
     AND o.delivered_at IS NOT NULL AND o.delivered_at + v.d <= now() AND o.expires_at > now()
     AND o.followup_opt_in AND o.followup_unsubscribed_at IS NULL
     AND coalesce((o.notifications->v.k->>'done')::boolean, false) = false
     AND coalesce((o.notifications->v.k->>'attempts')::int, 0) < 6
     AND coalesce((o.notifications->v.k->>'nextAt')::timestamptz, '-infinity') <= now()
     AND coalesce((o.notifications->v.k->>'claimedUntil')::timestamptz, '-infinity') < now()
   ORDER BY o.delivered_at LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.due_followups(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_followups(integer) TO service_role;