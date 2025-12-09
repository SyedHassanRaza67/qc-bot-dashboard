-- Add user_id column to call_records table
ALTER TABLE public.call_records ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow public read access to call records" ON public.call_records;
DROP POLICY IF EXISTS "Allow public insert of call records" ON public.call_records;

-- Create proper RLS policies requiring authentication
-- Users can only view their own records
CREATE POLICY "Users can view their own call records" 
ON public.call_records 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Users can only insert their own records
CREATE POLICY "Users can insert their own call records" 
ON public.call_records 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own records
CREATE POLICY "Users can update their own call records" 
ON public.call_records 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own records
CREATE POLICY "Users can delete their own call records" 
ON public.call_records 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Allow service role to insert (for edge function using service role key)
CREATE POLICY "Service role can insert call records"
ON public.call_records
FOR INSERT
TO service_role
WITH CHECK (true);