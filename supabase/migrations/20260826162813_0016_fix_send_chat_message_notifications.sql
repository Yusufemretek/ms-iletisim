-- Fix: send_chat_message was inserting a notification with a non-existent user_id
-- (00000000-...) which violated the FK constraint to auth.users, causing the
-- entire function to fail and the message to never be saved.
-- Now we notify all actual admin users instead.

CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_sender_type text,
  p_message text DEFAULT NULL,
  p_image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg_id uuid;
  v_conv public.chat_conversations%ROWTYPE;
  v_admin RECORD;
BEGIN
  SELECT * INTO v_conv FROM public.chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konusma bulunamadi';
  END IF;

  IF p_sender_type = 'customer' THEN
    IF v_conv.user_id != auth.uid() THEN
      RAISE EXCEPTION 'Yetkisiz';
    END IF;
  ELSIF p_sender_type = 'admin' THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Yetkisiz';
    END IF;
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender_type, message, image_url)
  VALUES (p_conversation_id, p_sender_type, p_message, p_image_url)
  RETURNING id INTO v_msg_id;

  UPDATE public.chat_conversations
  SET last_message_at = now(),
      status = CASE WHEN p_sender_type = 'customer' THEN 'WAITING_REPLY' ELSE 'OPEN' END,
      updated_at = now()
  WHERE id = p_conversation_id;

  -- Notify all actual admin users when a customer sends a message
  IF p_sender_type = 'customer' THEN
    FOR v_admin IN SELECT user_id FROM public.admins LOOP
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (v_admin.user_id, 'Yeni Destek Mesajı', COALESCE(p_message, 'Resim gönderildi'), 'support');
    END LOOP;
  END IF;

  RETURN v_msg_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, text) TO anon;
