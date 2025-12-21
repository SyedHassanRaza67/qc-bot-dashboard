-- Create app_config table for flexible configuration
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify config
CREATE POLICY "Admins can view config" 
ON public.app_config 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update config" 
ON public.app_config 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default admin email (can be changed later via database)
INSERT INTO public.app_config (key, value) 
VALUES ('admin_email', 'raxahassan67@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- Replace the hardcoded assign_admin_role function with config-based version
CREATE OR REPLACE FUNCTION public.assign_admin_role()
RETURNS TRIGGER AS $$
DECLARE
  admin_email TEXT;
BEGIN
  -- Get admin email from config table instead of hardcoding
  SELECT value INTO admin_email FROM public.app_config WHERE key = 'admin_email';
  
  IF NEW.email = admin_email THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;