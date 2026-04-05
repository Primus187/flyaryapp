CREATE POLICY "Users can update own flight photos storage"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'flight-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);