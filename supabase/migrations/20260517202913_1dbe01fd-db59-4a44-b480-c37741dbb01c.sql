ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS screenshots text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preview_video_url text;