/*
# Fix push notification trigger to use correct edge function URL and auth

The previous trigger (0046) called the edge function without authentication
and used a hardcoded URL for a different project. This updates the trigger
function to:
1. Read SUPABASE_URL and SUPABASE_ANON_KEY from app_config
2. Call the send-push-notification edge function with proper auth header
3. Pass url and tag fields in the payload so the notification click
   navigates to the right page (order detail, service, etc.)
*/

CREATE OR REPLACE FUNCTION public.trg_fn_send_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_url text;
  v_anon_key text;
  v_edge_url text;
  v_payload jsonb;
  v_url text;
BEGIN
  SELECT value INTO v_base_url FROM public.app_config WHERE key = 'SUPABASE_URL';
  SELECT value INTO v_anon_key FROM public.app_config WHERE key = 'SUPABASE_ANON_KEY';

  IF v_base_url IS NULL OR v_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_edge_url := v_base_url || '/functions/v1/send-push-notification';

  -- Determine the URL to open when the notification is clicked
  v_url := '/';
  IF NEW.order_id IS NOT NULL THEN
    v_url := '/order/' || NEW.order_id;
  ELSIF NEW.service_id IS NOT NULL THEN
    v_url := '/teknik-servis';
  ELSIF NEW.trade_in_id IS NOT NULL THEN
    v_url := '/trade-in-requests';
  ELSIF NEW.sell_phone_id IS NOT NULL THEN
    v_url := '/sell-phone-requests';
  END IF;

  v_payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title', NEW.title,
    'body', NEW.message,
    'url', v_url,
    'tag', COALESCE(NEW.type, 'info')
  );

  PERFORM net.http_post(
    url := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := v_payload
  );

  RETURN NEW;
END;
$$;

-- Re-attach trigger (drop + create to be safe)
DROP TRIGGER IF EXISTS trg_send_push_notification ON public.notifications;
CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_send_push_notification();

REVOKE EXECUTE ON FUNCTION public.trg_fn_send_push_notification() FROM PUBLIC;
