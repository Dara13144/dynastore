CREATE OR REPLACE FUNCTION public.credit_topup_atomic(_request_id uuid, _bakong_response jsonb)
 RETURNS TABLE(ok boolean, new_balance integer, status text, credited integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user uuid;
  _coins integer;
  _amount numeric;
  _old integer;
  _new integer;
  _status text;
  _bal integer;
BEGIN
  UPDATE public.topup_requests
     SET status = 'approved',
         reviewed_at = now(),
         bakong_verified_at = now(),
         bakong_response = _bakong_response
   WHERE id = _request_id AND status = 'pending'
   RETURNING user_id, coins, amount_usd INTO _user, _coins, _amount;

  IF NOT FOUND THEN
    SELECT tr.status::text, w.balance INTO _status, _bal
      FROM public.topup_requests tr
      LEFT JOIN public.wallets w ON w.user_id = tr.user_id
     WHERE tr.id = _request_id;
    ok := false;
    new_balance := COALESCE(_bal, 0);
    status := COALESCE(_status, 'not_found');
    credited := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT balance INTO _old FROM public.wallets WHERE user_id = _user FOR UPDATE;
  _old := COALESCE(_old, 0);
  _new := _old + _coins;

  INSERT INTO public.wallets (user_id, balance) VALUES (_user, _new)
    ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now();

  INSERT INTO public.balance_changes (user_id, changed_by, old_balance, new_balance, reason)
  VALUES (_user, _user, _old, _new, 'Bakong auto-topup approved: $' || _amount || ' (+' || _coins || ')');

  ok := true;
  new_balance := _new;
  status := 'approved';
  credited := _coins;
  RETURN NEXT;
END;
$function$;