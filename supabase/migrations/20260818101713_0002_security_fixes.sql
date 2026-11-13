/*
# Guvenlik duzeltmeleri

1. set_updated_at fonksiyonuna search_path eklendi
2. SECURITY DEFINER fonksiyonlardan anon rolunden EXECUTE yetkisi kaldirildi
   (is_admin, bootstrap_first_admin, add_admin, create_order, set_order_status)
   Bu fonksiyonlar yalnizca authenticated rolunca cagrilabilmeli.
*/

-- set_updated_at search_path fix
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Revoke EXECUTE from anon on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_admin(target uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_order(p_address_id uuid, p_payment_method text, p_note text, p_items jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_order_status(p_order_id uuid, p_status text) FROM anon;
