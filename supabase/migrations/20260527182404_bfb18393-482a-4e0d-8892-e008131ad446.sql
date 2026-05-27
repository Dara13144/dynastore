
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS credited boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_payment_tx_user ON public.payment_transactions(user_id);

CREATE POLICY "users view own payments" ON public.payment_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.credit_payment_atomic(_payment_id uuid)
RETURNS TABLE(ok boolean, new_balance integer, status text, credited_coins integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user uuid;
  _amount numeric;
  _rate integer;
  _coins integer;
  _old integer;
  _new integer;
  _already boolean;
  _bal integer;
BEGIN
  SELECT user_id, amount, credited INTO _user, _amount, _already
    FROM public.payment_transactions WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'not_found'::text, 0; RETURN;
  END IF;

  IF _already THEN
    SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user;
    RETURN QUERY SELECT true, COALESCE(_bal,0), 'already_credited'::text, 0; RETURN;
  END IF;

  IF _user IS NULL THEN
    UPDATE public.payment_transactions
      SET status='paid', paid_at=COALESCE(paid_at, now()), credited=true
      WHERE id=_payment_id;
    RETURN QUERY SELECT true, 0, 'paid_no_user'::text, 0; RETURN;
  END IF;

  SELECT coins_per_usd INTO _rate FROM public.app_settings WHERE id=1;
  _rate := COALESCE(_rate, 1);
  _coins := GREATEST(0, floor(_amount * _rate))::int;

  SELECT balance INTO _old FROM public.wallets WHERE user_id=_user FOR UPDATE;
  _old := COALESCE(_old, 0);
  _new := _old + _coins;

  INSERT INTO public.wallets (user_id, balance) VALUES (_user, _new)
    ON CONFLICT (user_id) DO UPDATE SET balance=EXCLUDED.balance, updated_at=now();

  INSERT INTO public.balance_changes (user_id, changed_by, old_balance, new_balance, reason)
    VALUES (_user, _user, _old, _new, 'KHQR payment: $' || _amount || ' (+' || _coins || ')');

  UPDATE public.payment_transactions
    SET status='paid', paid_at=COALESCE(paid_at, now()), credited=true
    WHERE id=_payment_id;

  RETURN QUERY SELECT true, _new, 'credited'::text, _coins;
END;
$function$;
