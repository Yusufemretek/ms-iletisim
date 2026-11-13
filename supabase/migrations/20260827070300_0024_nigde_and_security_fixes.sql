-- ============================================================
-- MS İletişim - Niğde Service Area + Security Fixes
-- ============================================================

-- 1. Re-grant operator campaign RPC EXECUTE to authenticated
GRANT EXECUTE ON FUNCTION public.upsert_operator_campaign(json)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_operator_campaign(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_operator_campaigns()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_operator_lead_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_operator_leads()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_operator(json)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_campaign_category(json)        TO authenticated;

-- 2. Niğde-only delivery: CHECK constraint using Turkish ICU collation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addresses_city_nigde_check'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT addresses_city_nigde_check
      CHECK (city IS NULL OR lower(trim(city) COLLATE "tr-TR-x-icu") IN ('niğde', 'nigde'));
  END IF;
END $$;

-- 3. Fix sell_phone_requests INSERT policy: require user_id = auth.uid()
DROP POLICY IF EXISTS "sell_phone_insert_own" ON public.sell_phone_requests;
CREATE POLICY "sell_phone_insert_own" ON public.sell_phone_requests FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- 4. Fix trade_ins INSERT policy: require user_id = auth.uid()
DROP POLICY IF EXISTS "trade_in_insert_own" ON public.trade_ins;
CREATE POLICY "trade_in_insert_own" ON public.trade_ins FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- 5. Fix send_chat_message: validate sender_type + notify real admins
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_sender_type text,
  p_message text DEFAULT NULL,
  p_image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg_id uuid;
  v_conv public.chat_conversations%ROWTYPE;
BEGIN
  IF p_sender_type NOT IN ('customer', 'admin') THEN
    RAISE EXCEPTION 'Gecersiz gonderen tipi';
  END IF;

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

  IF p_sender_type = 'customer' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT a.user_id, 'Yeni Destek Mesaji', COALESCE(p_message, 'Resim gonderildi'), 'support'
    FROM public.admins a;
  END IF;

  RETURN v_msg_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, text) TO authenticated;

-- 6. Fix get_user_consent_preferences: add caller identity check
DROP FUNCTION IF EXISTS public.get_user_consent_preferences(uuid);
CREATE FUNCTION public.get_user_consent_preferences(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  consent_type text,
  consent_given boolean,
  consent_text text,
  ip_address text,
  user_agent text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz';
  END IF;

  RETURN QUERY
  SELECT cl.id, cl.user_id, cl.consent_type, cl.consent_given,
         cl.consent_text, cl.ip_address, cl.user_agent, cl.created_at
  FROM public.consent_logs cl
  WHERE cl.user_id = p_user_id
  ORDER BY cl.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_consent_preferences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_consent_preferences(uuid) TO authenticated;

-- 7. Revoke trigger function from PUBLIC (hygiene)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
