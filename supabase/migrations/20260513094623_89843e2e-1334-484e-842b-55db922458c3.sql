
CREATE TABLE IF NOT EXISTS public.app_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_audit_created ON public.app_settings_audit(created_at DESC);

ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view settings audit"
  ON public.app_settings_audit FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
