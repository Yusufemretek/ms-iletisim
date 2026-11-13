/*
# Comprehensive fixes for 10 issues

## Issue 2: Order item images
- Add `image_url` column to `order_items` table.
- Backfill from `product_images` for existing rows.

## Issue 3: Payment status flow for courier collection
- Orders with `cash_on_delivery` / `card_on_delivery` start as `pending` payment status.
- `set_order_status` sets `paid` on `delivered`, correct for courier collection.

## Issue 4: Customer notifications on status changes
- Update `set_order_status` to send notifications for `confirmed`, `preparing`, `shipping` statuses.

## Issue 7: Customer ban feature
- Add `is_banned` boolean, `banned_reason` text, `banned_at` timestamp columns to `profiles`.
- Add admin-only update policy for ban fields.

## Issue 8: Performance improvements
- Add indexes on frequently queried columns.

## Issue 9: Auto-deactivate products on stock-out
- Trigger to set `is_active = false` when stock drops to 0.

## Issue 10: Category slug uniqueness
- Add unique constraint on `categories.slug`.
*/

-- Issue 2: Add image_url to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS image_url text;

-- Backfill image_url from product_images for existing order items
UPDATE public.order_items oi
SET image_url = (
  SELECT pi.image_url FROM public.product_images pi
  WHERE pi.product_id = oi.product_id
  AND pi.is_primary = true
  LIMIT 1
)
WHERE oi.image_url IS NULL
AND oi.product_id IS NOT NULL;

UPDATE public.order_items oi
SET image_url = (
  SELECT pi.image_url FROM public.product_images pi
  WHERE pi.product_id = oi.product_id
  ORDER BY pi.position ASC
  LIMIT 1
)
WHERE oi.image_url IS NULL
AND oi.product_id IS NOT NULL;

-- Issue 7: Add ban columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;

-- Issue 8: Performance indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_active_type ON public.products(is_active, type);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_campaigns_active ON public.operator_campaigns(active, archived, featured);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_id ON public.sales(order_id);
CREATE INDEX IF NOT EXISTS idx_trade_ins_status ON public.trade_ins(status);
CREATE INDEX IF NOT EXISTS idx_sell_phone_status ON public.sell_phone_requests(status);
CREATE INDEX IF NOT EXISTS idx_operator_leads_campaign_id ON public.operator_leads(campaign_id);

-- Issue 10: Category slug uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON public.categories(slug);

-- Issue 9: Auto-deactivate products when stock hits 0
CREATE OR REPLACE FUNCTION public.auto_deactivate_on_stock_zero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock <= 0 AND OLD.stock > 0 THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_deactivate_product ON public.products;
CREATE TRIGGER trg_auto_deactivate_product
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deactivate_on_stock_zero();

-- Issue 4: Update set_order_status to send notifications on all status changes
CREATE OR REPLACE FUNCTION public.set_order_status(p_order_id uuid, p_status text)
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
  v_notif_title text;
  v_notif_msg text;
  v_existing_sale_count int;
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
      -- Only create sale if not already exists
      SELECT COUNT(*) INTO v_existing_sale_count
      FROM public.sales WHERE order_id = p_order_id AND order_item_id = v_item.id;

      IF v_existing_sale_count = 0 THEN
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
      END IF;
    END LOOP;

    v_notif_title := 'Siparişiniz Teslim Edildi';
    v_notif_msg := 'Siparişiniz başarıyla teslim edilmiştir. Bizi tercih ettiğiniz için teşekkürler!';
  ELSIF p_status = 'confirmed' THEN
    v_notif_title := 'Siparişiniz Onaylandı';
    v_notif_msg := 'Siparişiniz onaylandı ve hazırlanmaya başlanacak.';
  ELSIF p_status = 'preparing' THEN
    v_notif_title := 'Siparişiniz Hazırlanıyor';
    v_notif_msg := 'Siparişiniz hazırlanıyor. En kısa sürede teslim edilecektir.';
  ELSIF p_status = 'shipping' THEN
    v_notif_title := 'Siparişiniz Teslimata Çıktı';
    v_notif_msg := 'Siparişiniz kurye ile yola çıktı. Teslimatınızı bekliyoruz.';
  ELSIF p_status = 'cancelled' AND v_order.status <> 'cancelled' THEN
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
      IF v_item.product_id IS NOT NULL THEN
        UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
      END IF;
    END LOOP;
    v_notif_title := 'Siparişiniz İptal Edildi';
    v_notif_msg := 'Siparişiniz iptal edilmiştir. Ödeme iadesi 3 iş günü içinde yapılacaktır.';
  END IF;

  -- Kurye/teslimat: deliveries tablosuna kayit ekle
  IF p_status = 'shipping' THEN
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

  -- Bildirim gonder (tum durum degisiklikleri icin)
  IF v_order.user_id IS NOT NULL AND v_notif_title IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (v_order.user_id, v_notif_title, v_notif_msg, 'order', p_order_id);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_status(uuid, text) TO authenticated;

-- Issue 7: Add admin-only policy for banning customers
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Issue 3: Payment status constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_payment_status_valid;
ALTER TABLE public.orders ADD CONSTRAINT chk_payment_status_valid 
  CHECK (payment_status IN ('pending', 'partial', 'paid'));

NOTIFY pgrst, 'reload schema';