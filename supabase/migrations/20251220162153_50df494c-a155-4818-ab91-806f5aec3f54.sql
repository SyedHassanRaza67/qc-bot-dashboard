-- Create table for storing dialer integration credentials
CREATE TABLE public.dialer_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dialer_type TEXT NOT NULL DEFAULT 'vicidial',
  server_url TEXT NOT NULL,
  api_user TEXT NOT NULL,
  api_pass_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, dialer_type)
);

-- Enable RLS
ALTER TABLE public.dialer_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own integrations
CREATE POLICY "Users can view their own integrations"
ON public.dialer_integrations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own integrations
CREATE POLICY "Users can insert their own integrations"
ON public.dialer_integrations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own integrations
CREATE POLICY "Users can update their own integrations"
ON public.dialer_integrations
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own integrations
CREATE POLICY "Users can delete their own integrations"
ON public.dialer_integrations
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_dialer_integrations_updated_at
BEFORE UPDATE ON public.dialer_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();