
-- 1. Hide games.file_path from public; add has_file flag
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS has_file boolean GENERATED ALWAYS AS (file_path IS NOT NULL) STORED;
REVOKE SELECT (file_path) ON public.games FROM anon, authenticated;

-- 2. Library: restrict self-insert to wishlist only
DROP POLICY IF EXISTS "users insert own library" ON public.library;
CREATE POLICY "users insert own wishlist" ON public.library
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND kind = 'wishlist');

-- 3. Click tracking: remove public insert; only server (service_role) writes
DROP POLICY IF EXISTS "Anyone can record a click" ON public.click_tracking;

-- 4. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.purchase_game_atomic(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_topup_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_balance(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_balance(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 5. Remove wallets from realtime publication (no subscribers in app)
ALTER PUBLICATION supabase_realtime DROP TABLE public.wallets;
