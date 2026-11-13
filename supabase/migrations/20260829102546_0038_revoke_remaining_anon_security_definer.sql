-- Revoke EXECUTE on remaining SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_notify_new_order() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_notify_operator_lead() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_notify_order_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_notify_sell_phone() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_notify_service_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_notify_trade_in() FROM anon;
