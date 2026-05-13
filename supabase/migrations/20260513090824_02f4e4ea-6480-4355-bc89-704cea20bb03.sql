
-- 1. Add visibility column
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

-- 2. Replace public select policy: only visible OR admin
DROP POLICY IF EXISTS "games are public" ON public.games;
CREATE POLICY "public sees visible games" ON public.games FOR SELECT USING (visible = true);
CREATE POLICY "admins see all games" ON public.games FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert games" ON public.games FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update games" ON public.games FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete games" ON public.games FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 3. Update handle_new_user to auto-assign admin role to specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Player'),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  IF lower(NEW.email) = 'dinacomputer0110@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

-- 4. Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. If admin already exists, grant role now
DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'dinacomputer0110@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END $$;
