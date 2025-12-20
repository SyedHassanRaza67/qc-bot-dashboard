-- Add lead_id column to call_records table for VICIdial lead tracking
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS lead_id TEXT;