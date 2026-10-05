CREATE TABLE public.payment_redemptions (
  session_id text PRIMARY KEY,
  tier text NOT NULL CHECK (tier IN ('revamp','scratch','bundle')),
  amount_cents integer NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'building' CHECK (status IN ('building','delivered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_redemptions TO service_role;
ALTER TABLE public.payment_redemptions ENABLE ROW LEVEL SECURITY;