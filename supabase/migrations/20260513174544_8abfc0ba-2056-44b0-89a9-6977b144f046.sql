
CREATE TABLE public.telegram_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  chat_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  http_status int,
  error text,
  attempts int NOT NULL DEFAULT 1,
  message_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_notifications_created_at_idx ON public.telegram_notifications (created_at DESC);
CREATE INDEX telegram_notifications_status_idx ON public.telegram_notifications (status, created_at DESC);
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read telegram_notifications"
  ON public.telegram_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
