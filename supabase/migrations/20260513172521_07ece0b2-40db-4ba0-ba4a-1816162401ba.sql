CREATE TABLE public.download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  via text NOT NULL CHECK (via IN ('direct','link')),
  url text NOT NULL,
  file_path text,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX download_logs_created_at_idx ON public.download_logs (created_at DESC);
CREATE INDEX download_logs_user_id_idx ON public.download_logs (user_id);
CREATE INDEX download_logs_game_id_idx ON public.download_logs (game_id);

ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view download logs"
ON public.download_logs FOR SELECT TO public
USING (public.has_role(auth.uid(), 'admin'::app_role));