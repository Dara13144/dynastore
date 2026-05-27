DROP FUNCTION IF EXISTS public.purchase_game_atomic(uuid, text);

CREATE OR REPLACE FUNCTION public.purchase_game_atomic(_user_id uuid, _game_id text)
RETURNS TABLE(ok boolean, new_balance integer, message text, delivered_content text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _price integer;
  _balance integer;
  _new_balance integer;
  _stock_id uuid;
  _content text;
BEGIN
  SELECT price_coins INTO _price FROM public.games WHERE id = _game_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'game_not_found', NULL::text; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.library WHERE user_id=_user_id AND game_id=_game_id AND kind='owned') THEN
    SELECT balance INTO _balance FROM public.wallets WHERE user_id=_user_id;
    SELECT content INTO _content
      FROM public.stock_items
      WHERE game_id=_game_id AND assigned_to=_user_id
      ORDER BY assigned_at DESC NULLS LAST LIMIT 1;
    RETURN QUERY SELECT true, COALESCE(_balance,0), 'already_owned', _content; RETURN;
  END IF;

  SELECT balance INTO _balance FROM public.wallets WHERE user_id=_user_id FOR UPDATE;
  IF _balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0);
    _balance := 0;
  END IF;

  IF _balance < _price THEN
    RETURN QUERY SELECT false, _balance, 'insufficient_balance', NULL::text; RETURN;
  END IF;

  SELECT id, content INTO _stock_id, _content
    FROM public.stock_items
    WHERE game_id=_game_id AND status='available'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF _stock_id IS NULL THEN
    RETURN QUERY SELECT false, _balance, 'out_of_stock', NULL::text; RETURN;
  END IF;

  UPDATE public.wallets
    SET balance = balance - _price, updated_at = now()
    WHERE user_id=_user_id
    RETURNING balance INTO _new_balance;

  UPDATE public.stock_items
    SET status='sold', assigned_to=_user_id, assigned_at=now()
    WHERE id=_stock_id;

  INSERT INTO public.library (user_id, game_id, kind) VALUES (_user_id, _game_id, 'owned')
    ON CONFLICT DO NOTHING;
  DELETE FROM public.library WHERE user_id=_user_id AND game_id=_game_id AND kind='wishlist';

  RETURN QUERY SELECT true, _new_balance, 'purchased', _content;
END;
$$;