-- Enum for transaction status
CREATE TYPE public.tx_status AS ENUM ('pending', 'paid', 'expired', 'cancelled');

-- Wallets
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Transactions (KHQR top-ups)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  md5 TEXT NOT NULL UNIQUE,
  qr_string TEXT NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  coins INTEGER NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user ON public.transactions(user_id);
CREATE INDEX idx_tx_md5 ON public.transactions(md5);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own tx" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- Games catalog
CREATE TABLE public.games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price_coins INTEGER NOT NULL DEFAULT 0,
  badge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games are public" ON public.games FOR SELECT USING (true);

INSERT INTO public.games (id, title, category, description, price_coins, badge) VALUES
  ('gta5','GTA 5 MODE','ប្រណាំង','ហ្គេមប្រណាំងតាមផ្លូវបែប Arcade ជាមួយក្រុមអនឡាញ។',2500,'ពេញនិយម'),
  ('neon','Neon Drift Legends','Racing','ប្រណាំងក្នុងទីក្រុងសាយប័រ ជាមួយមិត្តភក្តិអនឡាញ។',1800,'ពិសេស'),
  ('realm','Realmforge Odyssey','RPG','ដំណើរផ្សងព្រេងបែប Fantasy ដ៏ស្រស់ស្អាត។',2200,NULL),
  ('shadow','Shadow Ops','Action','បេសកកម្មសម្ងាត់ពេលយប់ ជាមួយយុទ្ធសាស្ត្រ។',2000,NULL),
  ('neonity','Neonity Tactics','Strategy','កសាងទីក្រុងនាពេលអនាគត។',1500,NULL),
  ('void','Void Wanderer','Adventure','ដំណើរផ្សងព្រេងលើភពផ្សេង។',1700,NULL);

-- Library (wishlist + owned)
CREATE TABLE public.library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('wishlist','owned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id, kind)
);
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own library" ON public.library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own library" ON public.library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own library" ON public.library FOR DELETE USING (auth.uid() = user_id);

-- Auto-create wallet for new users (extend existing handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Player'),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill wallets for existing users
INSERT INTO public.wallets (user_id, balance)
SELECT id, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Atomic credit (called by trusted server fn after Bakong verifies payment)
CREATE OR REPLACE FUNCTION public.credit_topup_atomic(_md5 TEXT)
RETURNS TABLE (ok BOOLEAN, new_balance INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _new_balance INTEGER;
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE md5 = _md5 FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 'transaction_not_found'; RETURN; END IF;
  IF _tx.status = 'paid' THEN
    SELECT balance INTO _new_balance FROM public.wallets WHERE user_id = _tx.user_id;
    RETURN QUERY SELECT true, COALESCE(_new_balance,0), 'already_credited'; RETURN;
  END IF;
  IF _tx.status <> 'pending' THEN RETURN QUERY SELECT false, 0, 'tx_not_pending'; RETURN; END IF;

  UPDATE public.transactions SET status='paid', paid_at=now() WHERE md5=_md5;
  INSERT INTO public.wallets (user_id, balance) VALUES (_tx.user_id, _tx.coins)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO _new_balance;
  RETURN QUERY SELECT true, _new_balance, 'credited';
END; $$;

-- Atomic purchase (deduct coins + insert into library as owned)
CREATE OR REPLACE FUNCTION public.purchase_game_atomic(_user_id UUID, _game_id TEXT)
RETURNS TABLE (ok BOOLEAN, new_balance INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _price INTEGER; _balance INTEGER; _new_balance INTEGER;
BEGIN
  SELECT price_coins INTO _price FROM public.games WHERE id = _game_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 'game_not_found'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.library WHERE user_id=_user_id AND game_id=_game_id AND kind='owned') THEN
    SELECT balance INTO _balance FROM public.wallets WHERE user_id=_user_id;
    RETURN QUERY SELECT true, COALESCE(_balance,0), 'already_owned'; RETURN;
  END IF;
  SELECT balance INTO _balance FROM public.wallets WHERE user_id=_user_id FOR UPDATE;
  IF _balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0); _balance := 0;
  END IF;
  IF _balance < _price THEN RETURN QUERY SELECT false, _balance, 'insufficient_balance'; RETURN; END IF;
  UPDATE public.wallets SET balance = balance - _price, updated_at=now() WHERE user_id=_user_id RETURNING balance INTO _new_balance;
  INSERT INTO public.library (user_id, game_id, kind) VALUES (_user_id, _game_id, 'owned')
    ON CONFLICT DO NOTHING;
  -- Remove from wishlist if present
  DELETE FROM public.library WHERE user_id=_user_id AND game_id=_game_id AND kind='wishlist';
  RETURN QUERY SELECT true, _new_balance, 'purchased';
END; $$;