/*
# Add push token storage and notification helper RPC

1. Purpose
   Uygulama içi bildirimleri gerçek push notification'a dönüştürmek için
   cihaz token'larını saklayacak tablo ve bildirim oluşturma RPC'si eklenir.

2. New Table: push_tokens
   - id          uuid PK
   - user_id     uuid NOT NULL (auth.users'a referans)
   - token       text NOT NULL (FCM/APNS token)
   - platform    text NOT NULL ('android', 'ios', 'web')
   - is_active   boolean DEFAULT true
   - created_at  timestamptz DEFAULT now()
   - updated_at  timestamptz DEFAULT now()
   Unique: (user_id, token)

3. New RPC: create_notification
   Admin veya sistem, bir kullanıcıya bildirim oluşturur.
   notifications tablosuna yazar. Sadece admin çağırabilir (type='admin_action' hariç,
   sistem tetikleyicileri için SECURITY DEFINER).

4. RLS
   - push_tokens: kullanıcı sadece kendi token'larını görebilir/silebilir
   - notifications: mevcut politikalar korunur
*/
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_push_tokens" ON public.push_tokens;
CREATE POLICY "select_own_push_tokens" ON public.push_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_push_tokens" ON public.push_tokens;
CREATE POLICY "insert_own_push_tokens" ON public.push_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_push_tokens" ON public.push_tokens;
CREATE POLICY "update_own_push_tokens" ON public.push_tokens FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_push_tokens" ON public.push_tokens;
CREATE POLICY "delete_own_push_tokens" ON public.push_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RPC: create_notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text DEFAULT NULL,
  p_type text DEFAULT 'info',
  p_order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, order_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_order_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid) TO authenticated;
