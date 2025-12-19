-- Create storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-recordings' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view audio files (public bucket)
CREATE POLICY "Public can view audio files"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-recordings');

-- Allow users to delete their own audio files
CREATE POLICY "Users can delete own audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);