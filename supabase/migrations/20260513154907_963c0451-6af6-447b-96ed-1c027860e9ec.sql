DROP FUNCTION IF EXISTS public.credit_topup_atomic(text) CASCADE;
DROP FUNCTION IF EXISTS public.credit_topup_atomic(text, text) CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TYPE IF EXISTS public.tx_status CASCADE;

DROP POLICY IF EXISTS "Users can upload own topup receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own topup receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all topup receipts" ON storage.objects;