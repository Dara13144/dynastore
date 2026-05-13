-- Drop auth trigger that wrote into wallets
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop coin-credit RPC
DROP FUNCTION IF EXISTS public.credit_topup_atomic(text, text);

-- Drop coin/wallet/library/transactions tables
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.library CASCADE;

-- Drop the tx_status enum (only used by transactions)
DROP TYPE IF EXISTS public.tx_status;