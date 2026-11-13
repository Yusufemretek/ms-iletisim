/*
# Add trigger to send push notification on notification insert

When a row is inserted into notifications, fire the edge function
to deliver a real push notification to the user's devices.
Uses pg_net for async HTTP calls (non-blocking).
*/

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trg_fn_send_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edge_url text;
  v_payload jsonb;
BEGIN
  v_edge_url := current_setting('app.edge_function_url', true);
  IF v_edge_url IS NULL THEN
    v_edge_url := 'https://wpqxmzqzgifrbefcnvqt.supabase.co/functions/v1/send-push-notification';
  END IF;

  v_payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title', NEW.title,
    'body', NEW.message,
    'data', jsonb_build_object(
      'notification_id', NEW.id,
      'type', NEW.type,
      'order_id', NEW.order_id
    )
  );

  -- Fire and forget — non-blocking HTTP POST
  PERFORM net.http_post(
    url := v_edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_payload
  );

  RETURN NEW;
END;
$$;

-- Drop old trigger if exists, create new one
DROP TRIGGER IF EXISTS trg_send_push_notification ON public.notifications;
CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_send_push_notification();

REVOKE EXECUTE ON FUNCTION public.trg_fn_send_push_notification() FROM PUBLIC;
