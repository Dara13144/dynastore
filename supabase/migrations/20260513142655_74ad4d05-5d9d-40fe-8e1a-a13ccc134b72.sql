-- Enforce QR/MD5 consistency at the DB layer.
-- NOT VALID skips checking existing legacy rows, but enforces on all future
-- INSERT and UPDATE operations.

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_qr_string_shape
  CHECK (
    qr_string IS NOT NULL
    AND length(qr_string) >= 50
    AND left(qr_string, 4) = '0002'
  ) NOT VALID;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_bakong_md5_shape
  CHECK (
    bakong_md5 IS NOT NULL
    AND bakong_md5 ~ '^[a-f0-9]{32}$'
  ) NOT VALID;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_md5_matches_qr
  CHECK (bakong_md5 = md5(qr_string)) NOT VALID;