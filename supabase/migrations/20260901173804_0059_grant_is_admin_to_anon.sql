/*
# Fix: Grant EXECUTE on is_admin() to anon role

## Problem
The `operator_campaigns` table has an RLS policy `campaigns_public_read` that calls `is_admin()`.
The `anon` role does not have EXECUTE permission on `is_admin()`, so when an unauthenticated
user visits the homepage, the query fails with "permission denied for function is_admin"
and the operator campaigns section never renders.

## Fix
Grant EXECUTE on `is_admin()` to the `anon` role. This is safe because `is_admin()` is a
read-only boolean check function that simply queries auth metadata — it does not mutate data
or expose sensitive information. The function returns true/false and anon users will always
get false, which is the correct behavior.

## Security
- No new tables or columns.
- No policy changes.
- Only grants EXECUTE on a read-only helper function to the anon role.
*/

GRANT EXECUTE ON FUNCTION is_admin() TO anon;