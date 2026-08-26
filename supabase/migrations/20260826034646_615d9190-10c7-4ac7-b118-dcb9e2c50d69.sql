CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  tier text NOT NULL,
  template text NOT NULL,
  source_label text,
  job_label text,
  resume jsonb NOT NULL,
  cover_letter text,
  ats_report jsonb,
  resume_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  letter_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX orders_expires_at_idx ON public.orders (expires_at);

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-expired-callback-orders',
  '17 3 * * *',
  $$DELETE FROM public.orders WHERE expires_at < now();$$
);