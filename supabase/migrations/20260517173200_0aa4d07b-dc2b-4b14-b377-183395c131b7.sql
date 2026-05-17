CREATE TABLE IF NOT EXISTS public.bakong_auth_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  token_source TEXT NOT NULL,
  token_fingerprint TEXT NOT NULL,
  token_length INTEGER NOT NULL,
  http_status INTEGER NOT NULL,
  response_snippet TEXT,
  renew_attempted BOOLEAN NOT NULL DEFAULT false,
  renew_succeeded BOOLEAN,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bakong_auth_failures_created_at
  ON public.bakong_auth_failures (created_at DESC);

ALTER TABLE public.bakong_auth_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read bakong_auth_failures"
  ON public.bakong_auth_failures FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));