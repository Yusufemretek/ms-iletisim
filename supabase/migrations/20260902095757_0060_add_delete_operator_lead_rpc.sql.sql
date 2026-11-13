/*
# Add delete operator lead RPC

1. New Functions
- `delete_operator_lead(p_lead_id uuid)` — SECURITY DEFINER function that allows admin users to delete an operator campaign lead (talep) from the `operator_leads` table.
- Checks `public.is_admin()` before deleting, same pattern as `update_operator_lead_status`.
- Returns void on success, raises exception on unauthorized access.

2. Security
- Function is SECURITY DEFINER so it can bypass RLS (operator_leads has no admin delete policy).
- Only callable by authenticated admin users (checked via `public.is_admin()`).
- EXECUTE revoked from anon/public, granted only to authenticated.
*/

CREATE OR REPLACE FUNCTION public.delete_operator_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  DELETE FROM public.operator_leads WHERE id = p_lead_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_operator_lead(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_operator_lead(uuid) TO authenticated;
