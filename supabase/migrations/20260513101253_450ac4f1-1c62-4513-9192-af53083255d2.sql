CREATE OR REPLACE FUNCTION public.admin_set_balance(_user_id uuid, _new_balance integer, _reason text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _old INTEGER;
  _b INTEGER;
  _max_abs CONSTANT INTEGER := 10000000;   -- max absolute balance
  _max_delta CONSTANT INTEGER := 1000000;  -- max change per single adjustment
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_balance IS NULL OR _new_balance < 0 THEN
    RAISE EXCEPTION 'invalid_balance: must be >= 0';
  END IF;
  IF _new_balance > _max_abs THEN
    RAISE EXCEPTION 'invalid_balance: exceeds maximum allowed (%)', _max_abs;
  END IF;

  SELECT balance INTO _old FROM public.wallets WHERE user_id = _user_id;
  _old := COALESCE(_old, 0);

  IF abs(_new_balance - _old) > _max_delta THEN
    RAISE EXCEPTION 'adjustment_too_large: change of % exceeds per-transaction limit of %', (_new_balance - _old), _max_delta;
  END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, _new_balance)
  ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO _b;

  INSERT INTO public.balance_changes (user_id, changed_by, old_balance, new_balance, reason)
  VALUES (_user_id, auth.uid(), _old, _b, NULLIF(trim(_reason), ''));

  RETURN _b;
END;
$function$;

-- Also harden the legacy 2-arg overload with the same caps
CREATE OR REPLACE FUNCTION public.admin_set_balance(_user_id uuid, _new_balance integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _old INTEGER;
  _b INTEGER;
  _max_abs CONSTANT INTEGER := 10000000;
  _max_delta CONSTANT INTEGER := 1000000;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_balance IS NULL OR _new_balance < 0 THEN
    RAISE EXCEPTION 'invalid_balance: must be >= 0';
  END IF;
  IF _new_balance > _max_abs THEN
    RAISE EXCEPTION 'invalid_balance: exceeds maximum allowed (%)', _max_abs;
  END IF;

  SELECT balance INTO _old FROM public.wallets WHERE user_id = _user_id;
  _old := COALESCE(_old, 0);

  IF abs(_new_balance - _old) > _max_delta THEN
    RAISE EXCEPTION 'adjustment_too_large: change of % exceeds per-transaction limit of %', (_new_balance - _old), _max_delta;
  END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, _new_balance)
  ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO _b;
  RETURN _b;
END;
$function$;