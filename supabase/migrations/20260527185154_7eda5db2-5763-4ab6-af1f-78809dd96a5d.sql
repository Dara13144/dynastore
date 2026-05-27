CREATE OR REPLACE FUNCTION public.purchase_game_atomic_qty(_user_id uuid, _game_id text, _qty integer)
 RETURNS TABLE(ok boolean, new_balance integer, message text, delivered_contents text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _price integer;
  _balance integer;
  _new_balance integer;
  _total_cost integer;
  _stock_ids uuid[];
  _contents text[];
BEGIN
  IF _qty IS NULL OR _qty < 1 THEN
    RETURN QUERY SELECT false, 0, 'invalid_qty'::text, ARRAY[]::text[]; RETURN;
  END IF;
  IF _qty > 50 THEN
    RETURN QUERY SELECT false, 0, 'qty_too_large'::text, ARRAY[]::text[]; RETURN;
  END IF;

  SELECT price_coins INTO _price FROM public.games WHERE id = _game_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'game_not_found'::text, ARRAY[]::text[]; RETURN;
  END IF;

  _total_cost := _price * _qty;

  SELECT balance INTO _balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0);
    _balance := 0;
  END IF;

  IF _balance < _total_cost THEN
    RETURN QUERY SELECT false, _balance, 'insufficient_balance'::text, ARRAY[]::text[]; RETURN;
  END IF;

  -- Reserve _qty available stock items atomically
  WITH picked AS (
    SELECT id, content
    FROM public.stock_items
    WHERE game_id = _game_id AND status = 'available'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT _qty
  )
  SELECT array_agg(id), array_agg(content) INTO _stock_ids, _contents FROM picked;

  IF _stock_ids IS NULL OR array_length(_stock_ids, 1) < _qty THEN
    RETURN QUERY SELECT false, _balance, 'out_of_stock'::text, ARRAY[]::text[]; RETURN;
  END IF;

  UPDATE public.wallets
    SET balance = balance - _total_cost, updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance INTO _new_balance;

  UPDATE public.stock_items
    SET status = 'sold', assigned_to = _user_id, assigned_at = now()
    WHERE id = ANY(_stock_ids);

  INSERT INTO public.library (user_id, game_id, kind)
    VALUES (_user_id, _game_id, 'owned')
    ON CONFLICT DO NOTHING;
  DELETE FROM public.library WHERE user_id = _user_id AND game_id = _game_id AND kind = 'wishlist';

  RETURN QUERY SELECT true, _new_balance, 'purchased'::text, _contents;
END;
$function$;