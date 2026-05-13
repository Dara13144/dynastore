CREATE TYPE public.topup_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL CHECK (amount_usd > 0 AND amount_usd <= 10000),
  coins INTEGER NOT NULL CHECK (coins >= 0),
  slip_path TEXT NOT NULL,
  note TEXT,
  status public.topup_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_topup_requests_status ON public.topup_requests(status, created_at DESC);
CREATE INDEX idx_topup_requests_user ON public.topup_requests(user_id, created_at DESC);

ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own topup requests" ON public.topup_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users create own topup requests" ON public.topup_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all topup requests" ON public.topup_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update topup requests" ON public.topup_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public) VALUES ('topup-slips','topup-slips', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users upload own topup slips" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'topup-slips' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users read own topup slips" ON storage.objects
  FOR SELECT USING (bucket_id = 'topup-slips' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "admins read all topup slips" ON storage.objects
  FOR SELECT USING (bucket_id = 'topup-slips' AND public.has_role(auth.uid(), 'admin'));