-- The chat-attachments bucket was created by hand in the old Lovable project; only its
-- storage policies were ever migrated (supabase/20260916064901). Create it for fresh projects.
-- Private (signed URLs only), 20 MB per file, same file types the chat file picker offers.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', false, 20971520, ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'text/csv', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;
