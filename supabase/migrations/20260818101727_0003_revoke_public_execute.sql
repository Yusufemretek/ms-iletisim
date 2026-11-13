/*
# SECURITY DEFINER fonksiyon erisim yetkilerini duzeltme

Supabase'de yeni fonksiyonlar varsayilan olarak PUBLIC'e EXECUTE yetkisi verir.
REVOKE ... FROM anon yeterli olmadi cunku PUBLIC uzerinden erisilebiliyor.
Cozum: PUBLIC'ten EXECUTE'i kaldir, yalnizca authenticated'a ver.
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.add_admin(target uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_admin(target uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_order(p_address_id uuid, p_payment_method text, p_note text, p_items jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(p_address_id uuid, p_payment_method text, p_note text, p_items jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_order_status(p_order_id uuid, p_status text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_status(p_order_id uuid, p_status text) TO authenticated;
