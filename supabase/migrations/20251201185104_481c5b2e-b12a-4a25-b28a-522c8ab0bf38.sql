-- Create call_records table to store analyzed audio data
CREATE TABLE public.call_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  caller_id TEXT NOT NULL,
  publisher TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sale', 'callback', 'not-interested', 'disqualified', 'pending')),
  agent_name TEXT,
  sub_disposition TEXT NOT NULL,
  duration TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  summary TEXT NOT NULL,
  system_call_id TEXT NOT NULL UNIQUE,
  publisher_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  recording_url TEXT,
  transcript TEXT NOT NULL,
  audio_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.call_records ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view call records (public data)
CREATE POLICY "Allow public read access to call records"
ON public.call_records
FOR SELECT
USING (true);

-- Create policy to allow anyone to create call records (for API uploads)
CREATE POLICY "Allow public insert of call records"
ON public.call_records
FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_call_records_updated_at
BEFORE UPDATE ON public.call_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_call_records_timestamp ON public.call_records(timestamp DESC);
CREATE INDEX idx_call_records_status ON public.call_records(status);
CREATE INDEX idx_call_records_system_call_id ON public.call_records(system_call_id);