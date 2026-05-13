
-- Manual topup requests (user uploads receipt → admin reviews)
CREATE TYPE public.manual_topup_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.manual_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL CHECK (amount_usd > 0 AND amount_usd <= 10000),
  coins INTEGER NOT NULL CHECK (coins >= 0),
  receipt_path TEXT NOT NULL,
  note TEXT,
  status public.manual_topup_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own manual topup" ON public.manual_topups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users view own manual topup" ON public.manual_topups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins view all manual topups" ON public.manual_topups
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update manual topups" ON public.manual_topups
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_manual_topups_updated_at
  BEFORE UPDATE ON public.manual_topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_manual_topups_status_created ON public.manual_topups (status, created_at DESC);

-- Storage bucket for receipt uploads (private; access via signed URL)
INSERT INTO storage.buckets (id, name, public) VALUES ('topup-receipts', 'topup-receipts', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users upload own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'topup-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users read own receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'topup-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "admins read all receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'topup-receipts' AND public.has_role(auth.uid(), 'admin'));

-- Atomic approval: credits wallet + marks request approved + logs balance change
CREATE OR REPLACE FUNCTION public.approve_manual_topup(_id UUID, _admin UUID)
RETURNS TABLE (ok BOOLEAN, new_balance INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.manual_topups%ROWTYPE;
  _old INTEGER;
  _new INTEGER;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO _row FROM public.manual_topups WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 'not_found'; RETURN; END IF;
  IF _row.status <> 'pending' THEN
    SELECT balance INTO _new FROM public.wallets WHERE user_id = _row.user_id;
    RETURN QUERY SELECT false, COALESCE(_new, 0), 'not_pending'; RETURN;
  END IF;

  SELECT balance INTO _old FROM public.wallets WHERE user_id = _row.user_id FOR UPDATE;
  _old := COALESCE(_old, 0);

  INSERT INTO public.wallets (user_id, balance) VALUES (_row.user_id, _row.coins)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO _new;

  UPDATE public.manual_topups
    SET status = 'approved', reviewed_by = _admin, reviewed_at = now()
    WHERE id = _id;

  INSERT INTO public.balance_changes (user_id, changed_by, old_balance, new_balance, reason)
  VALUES (_row.user_id, _admin, _old, _new, 'manual_topup_approved:' || _id::text);

  RETURN QUERY SELECT true, _new, 'approved';
END; $$;

CREATE OR REPLACE FUNCTION public.reject_manual_topup(_id UUID, _admin UUID, _reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.manual_topups
    SET status = 'rejected', reviewed_by = _admin, reviewed_at = now(), reject_reason = NULLIF(trim(_reason), '')
    WHERE id = _id AND status = 'pending';
  RETURN FOUND;
END; $$;
