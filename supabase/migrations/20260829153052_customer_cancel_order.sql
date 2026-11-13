/*
# Müşteri Sipariş İptal Fonksiyonu

1. Amaç
- Müşteriler kendi bekleyen (new status) siparişlerini iptal edebilsin.
- İptal sırasında stok geri eklensin ve bildirim gönderilsin.
- Sadece "new" durumundaki siparişler iptal edilebilsin (confirmed, preparing, shipping, delivered durumlarındakiler iptal edilemez).

2. Yeni RPC
- `cancel_my_order(p_order_id)`: Müşteri kendi siparişini iptal eder.
  - Sipariş sahibi kontrolü: auth.uid() = order.user_id
  - Sipariş durumu "new" olmalı
  - Stok geri eklenir
  - Sipariş durumu "cancelled" yapılır
  - Bildirim gönderilir

3. Güvenlik
- SECURITY DEFINER (stok güncelleme ve bildirim için)
- Sadece sipariş sahibi çağırabilir
- Sadece "new" durumundaki siparişler iptal edilebilir
- Execute: authenticated only
*/

CREATE OR REPLACE FUNCTION public.cancel_my_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siparis bulunamadi';
  END IF;

  IF v_order.user_id IS NULL OR v_order.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Bu siparisi iptal etme yetkiniz yok';
  END IF;

  IF v_order.status <> 'new' THEN
    RAISE EXCEPTION 'Sadece bekleyen siparisler iptal edilebilir';
  END IF;

  UPDATE public.orders SET status = 'cancelled' WHERE id = p_order_id;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
    UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
  END LOOP;

  INSERT INTO public.notifications (user_id, title, message, type, order_id)
  VALUES (v_order.user_id, 'Siparisiniz Iptal Edildi', 'Siparisiniz iptal edildi.', 'order', p_order_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_my_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_order(uuid) TO authenticated;
