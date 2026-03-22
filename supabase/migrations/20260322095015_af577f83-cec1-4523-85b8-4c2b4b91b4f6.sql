-- Make flight-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'flight-photos';

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can view flight photos" ON storage.objects;

-- Create scoped read policy: authenticated users can view their own photos
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'flight-photos' AND auth.uid()::text = (storage.foldername(name))[1]);