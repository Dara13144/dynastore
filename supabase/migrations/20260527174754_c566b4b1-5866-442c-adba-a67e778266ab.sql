
-- Extend games with product metadata
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS stock_cap integer NOT NULL DEFAULT 0;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS cover_emoji text;

-- Stock items (credentials) referenced by purchase_game_atomic
CREATE TABLE IF NOT EXISTS public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  assigned_to uuid,
  assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_game_status ON public.stock_items(game_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_items_assigned_to ON public.stock_items(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage stock_items"
  ON public.stock_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users view own assigned stock"
  ON public.stock_items FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());
