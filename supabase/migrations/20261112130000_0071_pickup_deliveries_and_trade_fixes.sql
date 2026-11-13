/*
# Takas / Teknik Servis evden alımlarını Kurye & Teslimat'a bağlama + takas onay düzeltmesi

1. deliveries tablosu artık sadece siparişlere bağlı değil:
   - order_id NULL olabilir
   - source_type ('ORDER' | 'TRADE_IN' | 'SERVICE'), trade_in_id, service_id,
     customer_name, title sütunları eklendi.

2. Otomatik kurye kaydı:
   - Teknik servis: müşteri "evden alım" isterse kayıt açılır açılmaz kurye listesine düşer.
   - Takas: evden alım istenen takas onaylandığında (admin onayı veya müşterinin
     karşı teklifi kabul etmesi) kurye listesine düşer.
   - Mevcut (daha önce oluşturulmuş) bekleyen kayıtlar için de geriye dönük kurye kaydı açılır.

3. assign_courier_delivery(p_delivery_id, p_courier_id): sipariş olmayan kayıtlara da
   kurye atanabilmesi için yeni fonksiyon.

4. update_delivery_status: sipariş olmayan teslimatlarda sipariş/ödeme işlemleri atlanır.
   Takas alımı teslim alındığında takas COMPLETED olur.

5. approve_trade_in: 'COUNTERED' (karşı teklif gönderilmiş) durumdaki takas da
   onaylanabilir/reddedilebilir (önceden "zaten işlem yapılmış" hatası veriyordu).
*/

-- ============================================================
-- 1. deliveries şeması
-- ============================================================
ALTER TABLE public.deliveries ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'ORDER',
  ADD COLUMN IF NOT EXISTS trade_in_id uuid REFERENCES public.trade_ins(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.service_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS title text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_trade_in ON public.deliveries(trade_in_id) WHERE trade_in_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_service ON public.deliveries(service_id) WHERE service_id IS NOT NULL;

-- ============================================================
-- 2. Otomatik kurye kaydı: TAKAS
-- ============================================================
CREATE OR REPLACE FUNCTION public.trade_in_pickup_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND COALESCE(NEW.pickup_requested, false)
     AND NOT EXISTS (SELECT 1 FROM public.deliveries WHERE trade_in_id = NEW.id) THEN
    INSERT INTO public.deliveries
      (source_type, trade_in_id, delivery_type, status, slot_id, scheduled_date, address, phone, customer_name, title, notes)
    VALUES
      ('TRADE_IN', NEW.id, 'EVDEN_ALIM', 'PENDING', NEW.pickup_slot, NEW.pickup_date,
       NEW.pickup_address, COALESCE(NEW.pickup_phone, NEW.customer_phone), NEW.customer_name,
       'Takas ' || NEW.trade_number || ' — Evden Alım',
       COALESCE(NEW.old_device_brand, '') || ' ' || COALESCE(NEW.old_device_model, '') || ' cihazı müşteriden alınacak');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_in_pickup_delivery ON public.trade_ins;
CREATE TRIGGER trg_trade_in_pickup_delivery
  AFTER INSERT OR UPDATE OF status ON public.trade_ins
  FOR EACH ROW EXECUTE FUNCTION public.trade_in_pickup_delivery();

-- ============================================================
-- 3. Otomatik kurye kaydı: TEKNİK SERVİS
-- ============================================================
CREATE OR REPLACE FUNCTION public.service_pickup_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.pickup_requested, false)
     AND NEW.status NOT IN ('CANCELLED', 'DELIVERED', 'COMPLETED')
     AND NOT EXISTS (SELECT 1 FROM public.deliveries WHERE service_id = NEW.id) THEN
    INSERT INTO public.deliveries
      (source_type, service_id, delivery_type, status, slot_id, scheduled_date, address, phone, customer_name, title, notes)
    VALUES
      ('SERVICE', NEW.id, 'EVDEN_ALIM', 'PENDING', NEW.pickup_slot_id, NEW.pickup_date,
       NEW.pickup_address, COALESCE(NEW.pickup_phone, NEW.customer_phone), NEW.customer_name,
       'Servis ' || COALESCE(NEW.service_number, '') || ' — Evden Alım',
       COALESCE(NEW.device_brand, '') || ' ' || COALESCE(NEW.device_model, '') || ' cihazı müşteriden alınacak');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_pickup_delivery ON public.service_records;
CREATE TRIGGER trg_service_pickup_delivery
  AFTER INSERT OR UPDATE OF pickup_requested ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION public.service_pickup_delivery();

-- Geriye dönük: bekleyen evden alım kayıtları için kurye kaydı oluştur
INSERT INTO public.deliveries
  (source_type, trade_in_id, delivery_type, status, slot_id, scheduled_date, address, phone, customer_name, title)
SELECT 'TRADE_IN', t.id, 'EVDEN_ALIM', 'PENDING', t.pickup_slot, t.pickup_date, t.pickup_address,
       COALESCE(t.pickup_phone, t.customer_phone), t.customer_name, 'Takas ' || t.trade_number || ' — Evden Alım'
FROM public.trade_ins t
WHERE t.status = 'APPROVED' AND t.pickup_requested
  AND NOT EXISTS (SELECT 1 FROM public.deliveries d WHERE d.trade_in_id = t.id);

INSERT INTO public.deliveries
  (source_type, service_id, delivery_type, status, slot_id, scheduled_date, address, phone, customer_name, title)
SELECT 'SERVICE', s.id, 'EVDEN_ALIM', 'PENDING', s.pickup_slot_id, s.pickup_date, s.pickup_address,
       COALESCE(s.pickup_phone, s.customer_phone), s.customer_name, 'Servis ' || COALESCE(s.service_number, '') || ' — Evden Alım'
FROM public.service_records s
WHERE s.pickup_requested AND s.status = 'RECEIVED'
  AND NOT EXISTS (SELECT 1 FROM public.deliveries d WHERE d.service_id = s.id);

-- ============================================================
-- 4. Teslimat kaydına kurye atama (her kaynak türü için)
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_courier_delivery(
  p_delivery_id uuid,
  p_courier_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.deliveries%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Teslimat bulunamadi';
  END IF;

  UPDATE public.deliveries
  SET courier_id = p_courier_id,
      status = CASE WHEN status = 'PENDING' THEN 'ASSIGNED' ELSE status END,
      updated_at = now()
  WHERE id = p_delivery_id;

  IF v_delivery.order_id IS NOT NULL THEN
    UPDATE public.orders SET assigned_courier_id = p_courier_id WHERE id = v_delivery.order_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assign_courier_delivery(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_courier_delivery(uuid, uuid) TO authenticated;

-- ============================================================
-- 5. update_delivery_status: sipariş olmayan teslimatları destekle
-- ============================================================
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

  UPDATE public.deliveries SET status = p_status, collected_amount = COALESCE(p_collected_amount, 0), updated_at = now()
  WHERE id = p_delivery_id;

  -- Sipariş dışı kayıtlar (takas / servis evden alım)
  IF v_delivery.order_id IS NULL THEN
    IF p_status = 'DELIVERED' AND v_delivery.trade_in_id IS NOT NULL THEN
      UPDATE public.trade_ins SET status = 'COMPLETED', updated_at = now()
      WHERE id = v_delivery.trade_in_id AND status = 'APPROVED';
    END IF;
    RETURN;
  END IF;

  IF p_status = 'DELIVERED' AND p_collected_amount > 0 THEN
    v_cash_after := public.get_cash_balance() + p_collected_amount;
    INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (p_collected_amount, 'IN', v_cash_after, 'SALE', v_delivery.order_id, 'Kurye tahsilati');

    INSERT INTO public.payments (order_id, payment_method, amount, status, collected_by, collected_at)
    VALUES (v_delivery.order_id, 'cash_on_delivery', p_collected_amount, 'COMPLETED', auth.uid(), now());

    UPDATE public.orders SET payment_status = 'paid', status = 'delivered' WHERE id = v_delivery.order_id;
  END IF;

  IF p_status = 'DELIVERED' THEN
    UPDATE public.orders SET status = 'delivered' WHERE id = v_delivery.order_id AND status != 'delivered';
  END IF;

  IF p_status = 'FAILED' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_delivery.order_id;
    IF FOUND AND v_order.status <> 'cancelled' AND v_order.status <> 'delivered' THEN
      UPDATE public.orders SET status = 'cancelled' WHERE id = v_delivery.order_id;
      FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_delivery.order_id LOOP
        IF v_item.product_id IS NOT NULL THEN
          UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
        END IF;
      END LOOP;
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

-- ============================================================
-- 6. approve_trade_in: karşı teklif durumundakini de onayla/reddet
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_trade_in(
  p_trade_id uuid,
  p_approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade public.trade_ins%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_trade FROM public.trade_ins WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Takas kaydi bulunamadi';
  END IF;

  IF v_trade.status NOT IN ('PENDING', 'COUNTERED') THEN
    RAISE EXCEPTION 'Bu takas icin zaten islem yapilmis';
  END IF;

  IF p_approved THEN
    UPDATE public.trade_ins SET status = 'APPROVED', updated_at = now() WHERE id = p_trade_id;
  ELSE
    UPDATE public.trade_ins SET status = 'REJECTED', updated_at = now() WHERE id = p_trade_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'TRADE_IN_APPROVE', 'TRADE_IN', p_trade_id,
    'Takas onaylandi/reddedildi', jsonb_build_object('approved', p_approved));

  IF v_trade.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, trade_in_id)
    VALUES (v_trade.user_id,
      CASE WHEN p_approved THEN 'Takas Talebiniz Onaylandı' ELSE 'Takas Talebiniz Reddedildi' END,
      COALESCE(v_trade.old_device_brand, '') || ' ' || COALESCE(v_trade.old_device_model, '') || ' → ' || COALESCE(v_trade.new_product_name, ''),
      'trade_in', p_trade_id);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_trade_in(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_trade_in(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
