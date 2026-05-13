DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.manual_topups CASCADE;

DROP FUNCTION IF EXISTS public.process_khqr_payment_atomic(text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.credit_topup_atomic(text) CASCADE;
DROP FUNCTION IF EXISTS public.mark_transaction_poll_result(text, integer, integer, jsonb, public.tx_status) CASCADE;
DROP FUNCTION IF EXISTS public.approve_manual_topup(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.reject_manual_topup(uuid, uuid, text) CASCADE;

DROP TYPE IF EXISTS public.tx_status CASCADE;
DROP TYPE IF EXISTS public.manual_topup_status CASCADE;

ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS bakong_account_id,
  DROP COLUMN IF EXISTS bakong_merchant_name,
  DROP COLUMN IF EXISTS bakong_merchant_city,
  DROP COLUMN IF EXISTS bakong_merchant_phone;