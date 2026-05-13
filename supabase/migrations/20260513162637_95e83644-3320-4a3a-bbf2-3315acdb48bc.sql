
INSERT INTO storage.buckets (id, name, public) VALUES ('game-images', 'game-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "public read game-images" ON storage.objects FOR SELECT USING (bucket_id = 'game-images');
CREATE POLICY "admin write game-images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update game-images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete game-images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));
