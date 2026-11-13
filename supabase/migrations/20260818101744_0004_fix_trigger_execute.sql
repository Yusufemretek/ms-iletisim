/*
# set_order_number trigger fonksiyonu erisim duzeltmesi

set_order_number bir trigger fonksiyonudur ve dogrudan cagrilmasi gerekmez.
PUBLIC'ten EXECUTE yetkisini kaldir, authenticated'a ver (trigger icin gerekli).
*/

REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_number() TO authenticated;
