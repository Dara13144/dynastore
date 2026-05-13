DO $$ BEGIN
  CREATE TYPE public.tx_status AS ENUM ('pending', 'paid', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  md5 TEXT NOT NULL UNIQUE,
  qr_string TEXT NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  coins INTEGER NOT NULL,
  bakong_ref TEXT,
  status public.tx_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_md5_matches CHECK (md5 = md5(qr_string))
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON public.transactions(status);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users view own tx" ON public.transactions;
CREATE POLICY "users view own tx" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins view all tx" ON public.transactions;
CREATE POLICY "admins view all tx" ON public.transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.credit_topup_atomic(_md5 TEXT, _bakong_ref TEXT DEFAULT NULL)
RETURNS TABLE (ok BOOLEAN, new_balance INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _new_balance INTEGER;
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE md5 = _md5 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'transaction_not_found'; RETURN;
  END IF;
  IF _tx.status = 'paid' THEN
    SELECT balance INTO _new_balance FROM public.wallets WHERE user_id = _tx.user_id;
    RETURN QUERY SELECT true, COALESCE(_new_balance,0), 'already_credited'; RETURN;
  END IF;
  IF _tx.status <> 'pending' THEN
    RETURN QUERY SELECT false, 0, _tx.status::text; RETURN;
  END IF;

  UPDATE public.transactions
     SET status='paid', paid_at=now(), bakong_ref=COALESCE(_bakong_ref, bakong_ref)
   WHERE md5=_md5;

  INSERT INTO public.wallets (user_id, balance) VALUES (_tx.user_id, _tx.coins)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO _new_balance;

  RETURN QUERY SELECT true, _new_balance, 'credited';
END; $$;