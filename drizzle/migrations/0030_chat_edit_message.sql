-- Chat: authors can edit their own messages (text and mentions only). Editing goes through an RPC
-- so that nothing else of a message (channel, author, announcement flags) can be changed; there is
-- still no UPDATE policy on chat_messages. Edits do not notify anyone again.

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.chat_edit_message(_message uuid, _text text, _mentions uuid[] DEFAULT '{}')
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_messages m
  SET message = btrim(coalesce(_text, '')), mentions = coalesce(_mentions, '{}'), edited_at = now()
  WHERE m.id = _message
    AND m.user_id = auth.uid()
    AND public.chat_can_post(auth.uid(), m.channel_id)
    AND (btrim(coalesce(_text, '')) <> '' OR m.attachment_path IS NOT NULL);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'message cannot be edited' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_edit_message(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_edit_message(uuid, text, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
