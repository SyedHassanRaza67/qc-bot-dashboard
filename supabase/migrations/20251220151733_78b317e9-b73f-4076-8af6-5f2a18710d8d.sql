-- Make the audio-recordings bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'audio-recordings';

-- Drop the public read policy
DROP POLICY IF EXISTS "Public can view audio files" ON storage.objects;

-- Add authenticated-only access policies
CREATE POLICY "Users can view own audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own audio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own audio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow service role to upload (for edge function)
CREATE POLICY "Service role can manage audio files"
ON storage.objects FOR ALL
USING (bucket_id = 'audio-recordings')
WITH CHECK (bucket_id = 'audio-recordings');