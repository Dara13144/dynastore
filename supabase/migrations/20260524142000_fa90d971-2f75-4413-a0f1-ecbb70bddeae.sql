CREATE TABLE public.click_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    button_label text NOT NULL,
    visitor_ip text,
    user_agent text,
    referrer text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.click_tracking ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert click records (anonymous tracking)
CREATE POLICY "Anyone can record a click"
ON public.click_tracking
FOR INSERT
TO public
WITH CHECK (true);

-- Only admins can view tracking data
CREATE POLICY "Admins can view click tracking"
ON public.click_tracking
FOR SELECT
TO public
USING (has_role(auth.uid(), 'admin'::app_role));