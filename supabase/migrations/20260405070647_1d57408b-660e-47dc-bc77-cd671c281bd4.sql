CREATE POLICY "Users can update own igc files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'igc-files' AND auth.uid()::text = (storage.foldername(name))[1]);