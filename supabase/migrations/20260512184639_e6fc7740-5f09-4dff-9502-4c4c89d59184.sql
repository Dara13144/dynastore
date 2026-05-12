
-- 1) Ensure md5 uniqueness so two pending tx can't share the same Bakong reference
CREATE UNIQUE INDEX IF NOT EXISTS transactions_md5_unique ON public.transactions (md5);

-- 2) Atomic credit: flip status pending->paid and bump wallet in one transaction.
--    Returns true only the first time it actually credits.
CREATE OR REPLACE FUNCTION public.credit_topup_atomic(_md5 text, _bakong_ref text)
RETURNS TABLE(credited boolean, coins_added integer, new_balance integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _new_balance integer;
BEGIN
  -- Lock the transaction row to serialize concurrent pollers
  SELECT * INTO _tx FROM public.transactions WHERE md5 = _md5 FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'not_found'::text;
    RETURN;
  END IF;

  IF _tx.status = 'paid' THEN
    SELECT coins INTO _new_balance FROM public.wallets WHERE user_id = _tx.user_id;
    RETURN QUERY SELECT false, 0, COALESCE(_new_balance, 0), 'paid'::text;
    RETURN;
  END IF;

  IF _tx.status <> 'pending' THEN
    RETURN QUERY SELECT false, 0, 0, _tx.status::text;
    RETURN;
  END IF;

  UPDATE public.transactions
     SET status = 'paid',
         paid_at = now(),
         bakong_ref = COALESCE(_bakong_ref, bakong_ref)
   WHERE id = _tx.id AND status = 'pending';

  INSERT INTO public.wallets (user_id, coins, updated_at)
  VALUES (_tx.user_id, _tx.coins, now())
  ON CONFLICT (user_id) DO UPDATE
    SET coins = public.wallets.coins + EXCLUDED.coins,
        updated_at = now()
  RETURNING coins INTO _new_balance;

  RETURN QUERY SELECT true, _tx.coins, _new_balance, 'paid'::text;
END;
$$;
