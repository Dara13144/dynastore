DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'tx_status' AND e.enumlabel = 'completed'
  ) THEN
    ALTER TYPE public.tx_status ADD VALUE 'completed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'tx_status' AND e.enumlabel = 'failed'
  ) THEN
    ALTER TYPE public.tx_status ADD VALUE 'failed';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'md5'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'bakong_md5'
  ) THEN
    ALTER TABLE public.transactions RENAME COLUMN md5 TO bakong_md5;
  END IF;
END $$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS order_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'khqr',
  ADD COLUMN IF NOT EXISTS gateway_event_id TEXT,
  ADD COLUMN IF NOT EXISTS bakong_tx_ref TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS provider_payload JSONB,
  ADD COLUMN IF NOT EXISTS last_poll_http_status INTEGER,
  ADD COLUMN IF NOT EXISTS last_poll_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.transactions
SET order_id = COALESCE(order_id, 'ord_' || replace(id::text, '-', ''))
WHERE order_id IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN order_id SET NOT NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_md5_key;
DROP INDEX IF EXISTS public.transactions_md5_unique;
DROP INDEX IF EXISTS public.idx_tx_md5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transactions_order_id_key'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_order_id_key UNIQUE (order_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tx_bakong_md5 ON public.transactions(bakong_md5);
CREATE INDEX IF NOT EXISTS idx_tx_user_status ON public.transactions(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_gateway_event_id_key
  ON public.transactions(gateway_event_id)
  WHERE gateway_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_bakong_tx_ref_key
  ON public.transactions(bakong_tx_ref)
  WHERE bakong_tx_ref IS NOT NULL;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.process_khqr_payment_atomic(
  _order_id TEXT,
  _gateway_event_id TEXT DEFAULT NULL,
  _bakong_tx_ref TEXT DEFAULT NULL,
  _provider_payload JSONB DEFAULT NULL
)
RETURNS TABLE (
  ok BOOLEAN,
  new_balance INTEGER,
  message TEXT,
  status public.tx_status,
  credited_coins INTEGER,
  transaction_id UUID,
  order_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _new_balance INTEGER;
BEGIN
  SELECT * INTO _tx
  FROM public.transactions
  WHERE transactions.order_id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'transaction_not_found', 'failed'::public.tx_status, 0, NULL::UUID, _order_id;
    RETURN;
  END IF;

  IF _gateway_event_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.gateway_event_id = _gateway_event_id
      AND t.id <> _tx.id
  ) THEN
    SELECT balance INTO _new_balance FROM public.wallets WHERE user_id = _tx.user_id;
    RETURN QUERY SELECT true, COALESCE(_new_balance, 0), 'duplicate_gateway_event', COALESCE(_tx.status, 'pending'::public.tx_status), 0, _tx.id, _tx.order_id;
    RETURN;
  END IF;

  IF _tx.status = 'completed' THEN
    SELECT balance INTO _new_balance FROM public.wallets WHERE user_id = _tx.user_id;
    RETURN QUERY SELECT true, COALESCE(_new_balance, 0), 'already_completed', 'completed'::public.tx_status, 0, _tx.id, _tx.order_id;
    RETURN;
  END IF;

  IF _tx.status IN ('expired', 'cancelled', 'failed') THEN
    SELECT balance INTO _new_balance FROM public.wallets WHERE user_id = _tx.user_id;
    RETURN QUERY SELECT false, COALESCE(_new_balance, 0), 'tx_not_payable', _tx.status, 0, _tx.id, _tx.order_id;
    RETURN;
  END IF;

  UPDATE public.transactions
  SET status = 'paid',
      paid_at = COALESCE(paid_at, now()),
      gateway_event_id = COALESCE(_gateway_event_id, gateway_event_id),
      bakong_tx_ref = COALESCE(_bakong_tx_ref, bakong_tx_ref),
      provider_payload = COALESCE(_provider_payload, provider_payload),
      failure_reason = NULL,
      updated_at = now()
  WHERE id = _tx.id;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (_tx.user_id, _tx.coins)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.wallets.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO _new_balance;

  UPDATE public.transactions
  SET status = 'completed',
      completed_at = COALESCE(completed_at, now()),
      gateway_event_id = COALESCE(_gateway_event_id, gateway_event_id),
      bakong_tx_ref = COALESCE(_bakong_tx_ref, bakong_tx_ref),
      provider_payload = COALESCE(_provider_payload, provider_payload),
      updated_at = now()
  WHERE id = _tx.id;

  RETURN QUERY SELECT true, COALESCE(_new_balance, 0), 'credited', 'completed'::public.tx_status, _tx.coins, _tx.id, _tx.order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_topup_atomic(_md5 TEXT)
RETURNS TABLE (ok BOOLEAN, new_balance INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_id TEXT;
  _row RECORD;
BEGIN
  SELECT t.order_id
  INTO _order_id
  FROM public.transactions t
  WHERE t.bakong_md5 = _md5
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF _order_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 'transaction_not_found';
    RETURN;
  END IF;

  SELECT *
  INTO _row
  FROM public.process_khqr_payment_atomic(_order_id, NULL, NULL, jsonb_build_object('source', 'legacy_md5'));

  RETURN QUERY SELECT COALESCE(_row.ok, false), COALESCE(_row.new_balance, 0), COALESCE(_row.message, 'unknown');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_transaction_poll_result(
  _order_id TEXT,
  _http_status INTEGER,
  _latency_ms INTEGER,
  _provider_payload JSONB,
  _next_status public.tx_status DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
BEGIN
  UPDATE public.transactions
  SET last_poll_http_status = _http_status,
      last_poll_latency_ms = _latency_ms,
      last_polled_at = now(),
      provider_payload = COALESCE(_provider_payload, provider_payload),
      status = COALESCE(_next_status, status),
      updated_at = now()
  WHERE order_id = _order_id
  RETURNING * INTO _tx;

  RETURN _tx;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_khqr_payment_atomic(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_khqr_payment_atomic(TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_transaction_poll_result(TEXT, INTEGER, INTEGER, JSONB, public.tx_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_transaction_poll_result(TEXT, INTEGER, INTEGER, JSONB, public.tx_status) TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_topup_atomic(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_topup_atomic(TEXT) TO service_role;