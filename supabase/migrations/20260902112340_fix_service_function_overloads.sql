-- Drop old overloaded versions that cause ambiguous function call errors
-- Keep only the newer, more complete versions with extra params (they have DEFAULTs so they work for all callers)

DROP FUNCTION IF EXISTS public.respond_to_service_quote(uuid, text);
DROP FUNCTION IF EXISTS public.update_service_status(uuid, text, numeric, numeric, numeric, text);
