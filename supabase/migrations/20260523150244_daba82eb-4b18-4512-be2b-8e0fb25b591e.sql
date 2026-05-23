-- Schedule auto-verification of pending Bakong topups every minute.
-- Calls the public TanStack server route which checks Bakong and credits
-- wallets via credit_topup_atomic when a transaction is confirmed.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Replace any prior schedule for this job to keep the migration idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verify-bakong-topups') THEN
    PERFORM cron.unschedule('verify-bakong-topups');
  END IF;
END$$;

SELECT cron.schedule(
  'verify-bakong-topups',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--c299877f-7af3-4cab-a4b4-973400b82e93.lovable.app/api/public/hooks/verify-bakong-topups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95b3dncHpvanhkeWFmaXphZ3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDIzNzIsImV4cCI6MjA5NDE3ODM3Mn0.D0APzjvGM-n7DoHIpGF7ypZsuiZO3kVLdi_Xk0D0lv0'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);