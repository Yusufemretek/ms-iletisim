/*
# Add notify_all_customers RPC
# Admin can broadcast a notification to ALL customers.
# Each inserted row triggers the push notification trigger automatically.
*/

CREATE OR REPLACE FUNCTION public.notify_all_customers(
  p_title text,
  p_message text,
  p_type text DEFAULT 'broadcast'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  FOR v_user IN SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' IS DISTINCT FROM 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_user.id, p_title, p_message, p_type);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_all_customers(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_all_customers(text, text, text) TO authenticated;
