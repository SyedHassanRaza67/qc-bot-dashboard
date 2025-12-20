-- Add upload_source column to track how records were added
ALTER TABLE public.call_records 
ADD COLUMN upload_source text NOT NULL DEFAULT 'manual';

-- Add comment for clarity
COMMENT ON COLUMN public.call_records.upload_source IS 'Source of the record: manual or dialer';