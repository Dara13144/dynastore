
-- Singleton settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  coins_per_usd INTEGER NOT NULL DEFAULT 1,
  tx_ttl_min INTEGER NOT NULL DEFAULT 5,
  bakong_account_id TEXT,
  bakong_merchant_name TEXT,
  bakong_merchant_city TEXT,
  bakong_merchant_phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id, coins_per_usd, tx_ttl_min)
VALUES (1, 1, 5)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read settings" ON public.app_settings
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update settings" ON public.app_settings
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin balance adjust RPC
CREATE OR REPLACE FUNCTION public.admin_set_balance(_user_id UUID, _new_balance INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _b INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_balance < 0 THEN
    RAISE EXCEPTION 'invalid_balance';
  END IF;
  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, _new_balance)
  ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO _b;
  RETURN _b;
END; $$;
