
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads visible promos" ON public.promotions FOR SELECT USING (visible = true);
CREATE POLICY "admins read all promos" ON public.promotions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert promos" ON public.promotions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update promos" ON public.promotions FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete promos" ON public.promotions FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_promotions_updated BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  game text,
  text text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads visible testimonials" ON public.testimonials FOR SELECT USING (visible = true);
CREATE POLICY "admins read all testimonials" ON public.testimonials FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert testimonials" ON public.testimonials FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update testimonials" ON public.testimonials FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete testimonials" ON public.testimonials FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_testimonials_updated BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.promotions (title, subtitle, visible) VALUES
  ('ប្រូម៉ូសិនពិសេសសប្តាហ៍នេះ', 'បន្ថែម 10 USD នឹងទទួលបាន 10 Balance ភ្លាមៗ។', true);
