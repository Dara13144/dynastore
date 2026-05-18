ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS tus_max_net_retries integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS tus_retry_delays_ms jsonb NOT NULL DEFAULT '[0,1000,3000,5000,10000,20000,30000,60000,120000]'::jsonb,
  ADD COLUMN IF NOT EXISTS tus_backoff_base_ms integer NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS tus_backoff_step_ms integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS tus_backoff_cap_ms integer NOT NULL DEFAULT 30000;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_tus_max_net_retries_ck CHECK (tus_max_net_retries BETWEEN 0 AND 500),
  ADD CONSTRAINT app_settings_tus_backoff_base_ck CHECK (tus_backoff_base_ms BETWEEN 0 AND 600000),
  ADD CONSTRAINT app_settings_tus_backoff_step_ck CHECK (tus_backoff_step_ms BETWEEN 0 AND 600000),
  ADD CONSTRAINT app_settings_tus_backoff_cap_ck CHECK (tus_backoff_cap_ms BETWEEN 0 AND 600000);