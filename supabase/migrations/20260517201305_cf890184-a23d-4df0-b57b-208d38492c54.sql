ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_storage_provider_check'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_storage_provider_check
      CHECK (storage_provider IN ('supabase','s3','external_url'));
  END IF;
END$$;