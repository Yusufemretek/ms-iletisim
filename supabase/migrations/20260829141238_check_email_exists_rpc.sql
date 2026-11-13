/*
# Email existence check + password reset support

1. RPC: check_email_exists
- SECURITY DEFINER function that checks if an email is already registered
  in auth.users. This is needed because RLS blocks anon users from reading
  profiles, so the client-side duplicate check fails silently.
- Returns boolean. Callable by anon (for registration pre-check).
*/

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;
