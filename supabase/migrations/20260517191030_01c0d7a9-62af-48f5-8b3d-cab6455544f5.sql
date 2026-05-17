CREATE TABLE public.tutorial_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  description TEXT,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads visible tutorial videos"
  ON public.tutorial_videos FOR SELECT
  USING (visible = true);

CREATE POLICY "admins read all tutorial videos"
  ON public.tutorial_videos FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert tutorial videos"
  ON public.tutorial_videos FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update tutorial videos"
  ON public.tutorial_videos FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete tutorial videos"
  ON public.tutorial_videos FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tutorial_videos_updated_at
  BEFORE UPDATE ON public.tutorial_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tutorial_videos (slug, title, video_url, visible)
VALUES
  ('topup', 'How to top up balance', '', true),
  ('buy_game', 'How to buy a game', '', true);