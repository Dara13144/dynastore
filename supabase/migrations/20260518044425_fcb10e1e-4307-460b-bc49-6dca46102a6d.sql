-- 1) Backend CHECK constraint: file_size_bytes must be NULL or in [1MB, 1000GB]
ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_file_size_bytes_range;

ALTER TABLE public.games
  ADD CONSTRAINT games_file_size_bytes_range
  CHECK (
    file_size_bytes IS NULL
    OR (
      file_size_bytes >= 1048576              -- 1 MiB
      AND file_size_bytes <= 1073741824000    -- 1000 GiB
    )
  );

-- 2) Align the game-files bucket per-object size limit with the client
UPDATE storage.buckets
SET file_size_limit = 1073741824000   -- 1000 GiB
WHERE id = 'game-files';
