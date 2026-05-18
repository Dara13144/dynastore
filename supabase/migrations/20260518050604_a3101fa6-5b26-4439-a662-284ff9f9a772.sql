-- Audit log for admin uploader: capture retry/resume/network events with offset.
CREATE TABLE IF NOT EXISTS public.upload_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id text,
  file_name text,
  file_size_bytes bigint,
  event_type text NOT NULL CHECK (event_type IN (
    'start','progress','pause','resume','retry','network_lost','network_restored',
    'success','error','abort','token_refresh'
  )),
  offset_bytes bigint,
  attempt integer,
  message text,
  online boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upload_audit_log_created_at_idx
  ON public.upload_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS upload_audit_log_user_id_idx
  ON public.upload_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS upload_audit_log_game_id_idx
  ON public.upload_audit_log (game_id, created_at DESC);

ALTER TABLE public.upload_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can write their own audit entries (client logs as the authenticated user).
CREATE POLICY "users insert own upload audit"
  ON public.upload_audit_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users may view their own entries (so the uploader UI can show recent events).
CREATE POLICY "users view own upload audit"
  ON public.upload_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view every entry.
CREATE POLICY "admins view all upload audit"
  ON public.upload_audit_log
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
