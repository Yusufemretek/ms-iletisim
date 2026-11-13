/*
# Auto-cancel order when delivery fails

## Changes
- Modifies `update_delivery_status` so that when p_status = 'FAILED':
  - The linked order's status is set to 'cancelled' (if not already cancelled/delivered)
  - Order items are restocked (same logic as set_order_status cancellation)
  - A notification is sent to the customer
- This ensures failed deliveries automatically cancel the order and restore inventory.
*/

CREATE OR REPLACE FUNCTION public.update_delivery_status(
  p_delivery_id uuid,
  p_status text,
  p_collected_amount numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.deliveries%ROWTYPE;
  v_cash_after numeric;
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Teslimat bulunamadi';
  END IF;

  IF p_status = 'DELIVERED' AND p_collected_amount > 0 THEN
    v_cash_after := public.get_cash_balance() + p_collected_amount;
    INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (p_collected_amount, 'IN', v_cash_after, 'SALE', v_delivery.order_id, 'Kurye tahsilati');

    INSERT INTO public.payments (order_id, payment_method, amount, status, collected_by, collected_at)
    VALUES (v_delivery.order_id, 'cash_on_delivery', p_collected_amount, 'COMPLETED', auth.uid(), now());

    UPDATE public.orders SET payment_status = 'paid', status = 'delivered' WHERE id = v_delivery.order_id;
  END IF;

  UPDATE public.deliveries SET status = p_status, collected_amount = p_collected_amount, updated_at = now()
  WHERE id = p_delivery_id;

  IF p_status = 'DELIVERED' THEN
    UPDATE public.orders SET status = 'delivered' WHERE id = v_delivery.order_id AND status != 'delivered';
  END IF;

  -- Teslimat basarisiz: siparisi otomatik iptal et ve stok geri ekle
  IF p_status = 'FAILED' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_delivery.order_id;
    IF FOUND AND v_order.status <> 'cancelled' AND v_order.status <> 'delivered' THEN
      UPDATE public.orders SET status = 'cancelled' WHERE id = v_delivery.order_id;

      -- Stok geri ekle
      FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_delivery.order_id LOOP
        IF v_item.product_id IS NOT NULL THEN
          UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
        END IF;
      END LOOP;

      -- Musteriye bildirim gonder
      IF v_order.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, order_id)
        VALUES (v_order.user_id, 'Teslimat Başarısız',
          'Siparişinizin teslimatı gerçekleştirilemedi. Siparişiniz iptal edilmiştir. Daha fazla bilgi için bizimle iletişime geçebilirsiniz.',
          'order', v_delivery.order_id);
      END IF;
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_delivery_status(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_delivery_status(uuid, text, numeric) TO authenticated;
