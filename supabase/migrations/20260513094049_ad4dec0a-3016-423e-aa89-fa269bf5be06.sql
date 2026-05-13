
CREATE TABLE IF NOT EXISTS public.balance_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  old_balance integer NOT NULL,
  new_balance integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_changes_user ON public.balance_changes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_changes_created ON public.balance_changes(created_at DESC);

ALTER TABLE public.balance_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view balance changes"
  ON public.balance_changes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_set_balance(_user_id uuid, _new_balance integer, _reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _old INTEGER; _b INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_balance < 0 THEN
    RAISE EXCEPTION 'invalid_balance';
  END IF;
  SELECT balance INTO _old FROM public.wallets WHERE user_id = _user_id;
  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, _new_balance)
  ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO _b;
  INSERT INTO public.balance_changes (user_id, changed_by, old_balance, new_balance, reason)
  VALUES (_user_id, auth.uid(), COALESCE(_old, 0), _b, NULLIF(trim(_reason), ''));
  RETURN _b;
END;
$function$;
