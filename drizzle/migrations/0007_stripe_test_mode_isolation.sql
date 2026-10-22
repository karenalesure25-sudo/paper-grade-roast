ALTER TABLE public.fulfillment_orders ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'live';
ALTER TABLE public.fulfillment_orders ADD CONSTRAINT fulfillment_orders_stripe_mode_chk CHECK (stripe_mode IN ('live','test'));
ALTER TABLE public.payment_redemptions ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'live';
ALTER TABLE public.payment_redemptions ADD CONSTRAINT payment_redemptions_stripe_mode_chk CHECK (stripe_mode IN ('live','test'));
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'live';
ALTER TABLE public.stripe_events ADD CONSTRAINT stripe_events_stripe_mode_chk CHECK (stripe_mode IN ('live','test'));

CREATE OR REPLACE FUNCTION public.fulfillment_orders_mode_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stripe_mode IS DISTINCT FROM OLD.stripe_mode THEN
    RAISE EXCEPTION 'payment mode is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fulfillment_orders_mode_immutable ON public.fulfillment_orders;
CREATE TRIGGER fulfillment_orders_mode_immutable BEFORE UPDATE ON public.fulfillment_orders
  FOR EACH ROW EXECUTE FUNCTION public.fulfillment_orders_mode_immutable();