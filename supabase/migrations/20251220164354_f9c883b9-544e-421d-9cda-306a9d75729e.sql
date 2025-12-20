-- Add agent_user column for VICIdial agent identifier
ALTER TABLE public.dialer_integrations 
ADD COLUMN IF NOT EXISTS agent_user TEXT;