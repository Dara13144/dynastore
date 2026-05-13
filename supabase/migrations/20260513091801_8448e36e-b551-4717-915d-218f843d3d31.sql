
-- 1. New columns
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

-- 2. Private bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('game-files', 'game-files', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS: admins manage; owners read
DROP POLICY IF EXISTS "admins manage game files" ON storage.objects;
CREATE POLICY "admins manage game files" ON storage.objects FOR ALL
  USING (bucket_id = 'game-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'game-files' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "owners read game files" ON storage.objects;
CREATE POLICY "owners read game files" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'game-files' AND EXISTS (
      SELECT 1 FROM public.library
      WHERE user_id = auth.uid() AND kind = 'owned'
        AND game_id = (storage.foldername(name))[1]
    )
  );

-- 4. Admin read access on users-related tables (for admin dashboard Users tab)
DROP POLICY IF EXISTS "admins view all profiles" ON public.profiles;
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins view all wallets" ON public.wallets;
CREATE POLICY "admins view all wallets" ON public.wallets FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins view all library" ON public.library;
CREATE POLICY "admins view all library" ON public.library FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins view all transactions" ON public.transactions;
CREATE POLICY "admins view all transactions" ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
