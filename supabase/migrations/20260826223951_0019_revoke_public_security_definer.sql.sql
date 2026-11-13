-- Some functions still callable by anon despite previous REVOKE.
-- Use REVOKE FROM PUBLIC to remove broad grants, then GRANT to authenticated only.

REVOKE EXECUTE ON FUNCTION assign_courier(p_order_id uuid, p_courier_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_courier(p_order_id uuid, p_courier_id uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_user_consent_preferences(p_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_consent_preferences(p_user_id uuid) TO authenticated;

-- handle_new_user is an auth trigger; must remain callable by anon
-- but it's safe — it only runs on INSERT to auth.users (signup trigger)
