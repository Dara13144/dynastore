CREATE TABLE IF NOT EXISTS public.bakong_token (
  id INTEGER PRIMARY KEY DEFAULT 1,
  token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bakong_token_singleton CHECK (id = 1)
);

ALTER TABLE public.bakong_token ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read bakong_token"
  ON public.bakong_token FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));