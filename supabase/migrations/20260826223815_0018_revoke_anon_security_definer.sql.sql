-- Revoke EXECUTE from anon role on all SECURITY DEFINER functions
-- These functions handle admin/financial operations and must not be
-- callable by unauthenticated users.

REVOKE EXECUTE ON FUNCTION add_admin(target uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION add_expense(p_category text, p_description text, p_amount numeric, p_payment_type text) FROM anon;
REVOKE EXECUTE ON FUNCTION add_loyalty_points(p_user_id uuid, p_points integer, p_reason text) FROM anon;
REVOKE EXECUTE ON FUNCTION add_payment(p_order_id uuid, p_payment_method text, p_amount numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION admins_count() FROM anon;
REVOKE EXECUTE ON FUNCTION approve_trade_in(p_trade_id uuid, p_approved boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION bootstrap_first_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION create_order(p_address_id uuid, p_payment_method text, p_note text, p_items jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION create_sale(p_sales_channel text, p_customer_name text, p_customer_phone text, p_customer_email text, p_user_id uuid, p_items jsonb, p_payments jsonb, p_delivery_type text, p_delivery_slot_id uuid, p_address_id uuid, p_note text, p_discount numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION create_sale(p_sales_channel text, p_customer_name text, p_customer_phone text, p_customer_email text, p_user_id uuid, p_items jsonb, p_payments jsonb, p_delivery_type text, p_delivery_slot_id uuid, p_address_id uuid, p_note text, p_discount numeric, p_installment_count integer) FROM anon;
REVOKE EXECUTE ON FUNCTION create_service_sale(p_service_id uuid, p_payment_method text) FROM anon;
REVOKE EXECUTE ON FUNCTION get_bank_balance() FROM anon;
REVOKE EXECUTE ON FUNCTION get_card_balance() FROM anon;
REVOKE EXECUTE ON FUNCTION get_cash_balance() FROM anon;
REVOKE EXECUTE ON FUNCTION get_financial_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION get_installment_options(p_product_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_store_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION get_user_consent_preferences(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION process_return(p_order_id uuid, p_items jsonb, p_reason text) FROM anon;
REVOKE EXECUTE ON FUNCTION run_daily_closing(p_closing_date date) FROM anon;
REVOKE EXECUTE ON FUNCTION sell_used_device(p_device_id uuid, p_payment_method text, p_customer_name text) FROM anon;
REVOKE EXECUTE ON FUNCTION send_chat_message(p_conversation_id uuid, p_sender_type text, p_message text, p_image_url text) FROM anon;
REVOKE EXECUTE ON FUNCTION set_order_number() FROM anon;
REVOKE EXECUTE ON FUNCTION set_order_status(p_order_id uuid, p_status text) FROM anon;
REVOKE EXECUTE ON FUNCTION set_sell_phone_number() FROM anon;
REVOKE EXECUTE ON FUNCTION set_service_number() FROM anon;
REVOKE EXECUTE ON FUNCTION set_trade_number() FROM anon;
REVOKE EXECUTE ON FUNCTION toggle_favorite(p_product_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION update_delivery_status(p_delivery_id uuid, p_status text, p_collected_amount numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION update_installment_settings(p_settings jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION update_sell_phone_offer(p_request_id uuid, p_offer_price numeric, p_status text, p_admin_notes text) FROM anon;
REVOKE EXECUTE ON FUNCTION update_service_status(p_service_id uuid, p_status text, p_service_price numeric, p_parts_cost numeric, p_labor_cost numeric, p_notes text) FROM anon;
REVOKE EXECUTE ON FUNCTION update_store_settings(p_settings jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION upsert_product(p_data jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION use_service_part(p_service_id uuid, p_product_id uuid, p_quantity integer) FROM anon;

-- Fix mutable search_path on update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
