-- Add is_processing column to track .wav files that need mp3 conversion
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS is_processing BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying of processing records
CREATE INDEX IF NOT EXISTS idx_call_records_is_processing ON public.call_records(is_processing) WHERE is_processing = TRUE;