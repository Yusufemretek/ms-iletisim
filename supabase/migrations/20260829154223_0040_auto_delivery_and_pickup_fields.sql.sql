/*
# Auto-create delivery on shipping + Pickup fields for trade-ins and sell-phone

## 1. Auto-create delivery record when order status becomes 'shipping'
- Modifies `set_order_status` to INSERT into `deliveries` when p_status = 'shipping'.
- Pulls address text and phone from the order's `addresses` join.
- Only creates if a delivery row doesn't already exist for that order.

## 2. Add pickup fields to `trade_ins`
- `pickup_requested` (boolean, default false) — customer wants home pickup
- `pickup_address` (text) — full address string for pickup
- `pickup_phone` (text) — contact phone for pickup
- `pickup_date` (date) — preferred pickup date
- `pickup_slot_id` (uuid, FK to delivery_slots) — preferred time slot

## 3. Add pickup fields to `sell_phone_requests`
- `pickup_address` (text) — full address string for pickup
- `pickup_phone` (text) — contact phone for pickup
- `pickup_date` (date) — preferred pickup date
- `pickup_slot_id` (uuid, FK to delivery_slots) — preferred time slot
- `pickup_preference` already exists as text; now actually used.

## 4. RLS
- No new tables. Existing RLS on deliveries, trade_ins, sell_phone_requests remains.
- New columns inherit existing table-level RLS.
*/

-- ============================================================
-- 1. Add pickup columns to trade_ins
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trade_ins' AND column_name = 'pickup_requested') THEN
    ALTER TABLE public.trade_ins ADD COLUMN pickup_requested boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trade_ins' AND column_name = 'pickup_address') THEN
    ALTER TABLE public.trade_ins ADD COLUMN pickup_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trade_ins' AND column_name = 'pickup_phone') THEN
    ALTER TABLE public.trade_ins ADD COLUMN pickup_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trade_ins' AND column_name = 'pickup_date') THEN
    ALTER TABLE public.trade_ins ADD COLUMN pickup_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trade_ins' AND column_name = 'pickup_slot_id') THEN
    ALTER TABLE public.trade_ins ADD COLUMN pickup_slot uuid REFERENCES public.delivery_slots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Add pickup columns to sell_phone_requests
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sell_phone_requests' AND column_name = 'pickup_address') THEN
    ALTER TABLE public.sell_phone_requests ADD COLUMN pickup_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sell_phone_requests' AND column_name = 'pickup_phone') THEN
    ALTER TABLE public.sell_phone_requests ADD COLUMN pickup_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sell_phone_requests' AND column_name = 'pickup_date') THEN
    ALTER TABLE public.sell_phone_requests ADD COLUMN pickup_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sell_phone_requests' AND column_name = 'pickup_slot_id') THEN
    ALTER TABLE public.sell_phone_requests ADD COLUMN pickup_slot uuid REFERENCES public.delivery_slots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 3. Update set_order_status to auto-create delivery on 'shipping'
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_cost numeric(12,2);
  v_addr public.addresses%ROWTYPE;
  v_addr_text text;
  v_addr_phone text;
  v_existing_delivery_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siparis bulunamadi';
  END IF;

  -- Durum guncelle
  UPDATE public.orders SET status = p_status WHERE id = p_order_id;

  -- Teslim edildi: odeme durumunu 'paid' yap ve satis kayitlari olustur
  IF p_status = 'delivered' THEN
    UPDATE public.orders SET payment_status = 'paid' WHERE id = p_order_id;

    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
      SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
      v_cost := COALESCE(v_product.cost_price, 0);
      INSERT INTO public.sales (
        order_id, order_item_id, user_id, product_name, cost_price,
        sale_price, quantity, total_sale, profit, payment_method
      ) VALUES (
        p_order_id, v_item.id, v_order.user_id, v_item.product_name, v_cost,
        v_item.unit_price, v_item.quantity, v_item.subtotal,
        (v_item.unit_price - v_cost) * v_item.quantity, v_order.payment_method
      );
    END LOOP;

    -- Bildirim gonder
    IF v_order.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (v_order.user_id, 'Siparişiniz Teslim Edildi',
        'Siparişiniz başarıyla teslim edilmiştir. Bizi tercih ettiğiniz için teşekkürler!',
        'order', p_order_id);
    END IF;
  END IF;

  -- Kurye/teslimat: deliveries tablosuna kayit ekle
  IF p_status = 'shipping' THEN
    -- Adres bilgisini al
    IF v_order.address_id IS NOT NULL THEN
      SELECT * INTO v_addr FROM public.addresses WHERE id = v_order.address_id;
      IF FOUND THEN
        v_addr_text := CONCAT_WS(', ',
          NULLIF(v_addr.neighborhood, ''),
          NULLIF(v_addr.street, ''),
          NULLIF(v_addr.district, ''),
          NULLIF(v_addr.city, '')
        );
        v_addr_phone := v_addr.phone;
      END IF;
    END IF;

    -- Eger bu siparis icin halihazirda bir delivery kaydi yoksa, yeni olustur
    SELECT COUNT(*) INTO v_existing_delivery_count
    FROM public.deliveries WHERE order_id = p_order_id;

    IF v_existing_delivery_count = 0 THEN
      INSERT INTO public.deliveries (
        order_id, delivery_type, status, address, phone,
        slot_id, scheduled_date
      ) VALUES (
        p_order_id,
        COALESCE(v_order.delivery_type, 'KURYE'),
        'PENDING',
        NULLIF(v_addr_text, ''),
        NULLIF(COALESCE(v_addr_phone, v_order.customer_phone), ''),
        v_order.delivery_slot_id,
        v_order.created_at::date
      );
    END IF;
  END IF;

  -- Iptal: stok geri ekle
  IF p_status = 'cancelled' AND v_order.status <> 'cancelled' THEN
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
      IF v_item.product_id IS NOT NULL THEN
        UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
      END IF;
    END LOOP;

    IF v_order.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (v_order.user_id, 'Siparişiniz İptal Edildi',
        'Siparişiniz iptal edilmiştir. Ödeme iadesi 3 iş günü içinde yapılacaktır.',
        'order', p_order_id);
    END IF;
  END IF;
END;
$$;
