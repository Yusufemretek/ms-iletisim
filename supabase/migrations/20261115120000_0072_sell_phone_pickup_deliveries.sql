/*
# Telefonunu Sat: evden alım → Kurye & Teslimat

ÖNKOŞUL: 0071_pickup_deliveries_and_trade_fixes uygulanmış olmalı
(deliveries.source_type, assign_courier_delivery vb.).

1. deliveries.sell_phone_id sütunu (source_type = 'SELL_PHONE').
2. Satış talebi 'ACCEPTED' olduğunda ve müşteri "evden alım" seçtiyse
   otomatik kurye kaydı açılır. Geriye dönük kabul edilmiş talepler için de açılır.
3. respond_sell_phone_offer(p_request_id, p_accept): müşteri teklifi kabul/ret eder.
   Ret durumu 'DECLINED'.
4. update_delivery_status: satış alımı teslim alındığında talep 'COMPLETED' olur.
5. Güvenlik: müşterinin kendi talebini doğrudan UPDATE etmesine izin veren politika
   kaldırıldı (aksi halde durumu kendisi 'ACCEPTED' yapıp kurye çağırabilirdi).
*/

-- ============================================================
-- 1. deliveries şeması
-- ============================================================
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS sell_phone_id uuid REFERENCES public.sell_phone_requests(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_sell_phone ON public.deliveries(sell_phone_id) WHERE sell_phone_id IS NOT NULL;

-- ============================================================
-- 2. Otomatik kurye kaydı: TELEFONUNU SAT
-- ============================================================
CREATE OR REPLACE FUNCTION public.sell_phone_pickup_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ACCEPTED' AND NEW.pickup_preference = 'EVDEN_ALIM'
     AND NOT EXISTS (SELECT 1 FROM public.deliveries WHERE sell_phone_id = NEW.id) THEN
    INSERT INTO public.deliveries
      (source_type, sell_phone_id, delivery_type, status, slot_id, scheduled_date, address, phone, customer_name, title, notes)
    VALUES
      ('SELL_PHONE', NEW.id, 'EVDEN_ALIM', 'PENDING', NEW.pickup_slot, NEW.pickup_date,
       NEW.pickup_address, COALESCE(NEW.pickup_phone, NEW.customer_phone), NEW.customer_name,
       'Satış ' || COALESCE(NEW.request_number, '') || ' — Evden Alım',
       COALESCE(NEW.brand, '') || ' ' || COALESCE(NEW.model, '') || ' cihazı müşteriden alınacak'
         || CASE WHEN NEW.offer_price IS NOT NULL THEN ' (Teklif: ' || NEW.offer_price || ' TL)' ELSE '' END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sell_phone_pickup_delivery ON public.sell_phone_requests;
CREATE TRIGGER trg_sell_phone_pickup_delivery
  AFTER INSERT OR UPDATE OF status ON public.sell_phone_requests
  FOR EACH ROW EXECUTE FUNCTION public.sell_phone_pickup_delivery();

-- Geriye dönük
INSERT INTO public.deliveries
  (source_type, sell_phone_id, delivery_type, status, slot_id, scheduled_date, address, phone, customer_name, title)
SELECT 'SELL_PHONE', s.id, 'EVDEN_ALIM', 'PENDING', s.pickup_slot, s.pickup_date, s.pickup_address,
       COALESCE(s.pickup_phone, s.customer_phone), s.customer_name,
       'Satış ' || COALESCE(s.request_number, '') || ' — Evden Alım'
FROM public.sell_phone_requests s
WHERE s.status = 'ACCEPTED' AND s.pickup_preference = 'EVDEN_ALIM'
  AND NOT EXISTS (SELECT 1 FROM public.deliveries d WHERE d.sell_phone_id = s.id);

-- ============================================================
-- 3. Müşteri teklife cevap verir
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_sell_phone_offer(
  p_request_id uuid,
  p_accept boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.sell_phone_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.sell_phone_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Satis talebi bulunamadi';
  END IF;

  IF v_req.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  IF v_req.status <> 'OFFERED' THEN
    RAISE EXCEPTION 'Bu talep icin bekleyen bir teklif yok';
  END IF;

  UPDATE public.sell_phone_requests
  SET status = CASE WHEN p_accept THEN 'ACCEPTED' ELSE 'DECLINED' END,
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'SELL_PHONE_RESPOND', 'SELL_PHONE_REQUEST', p_request_id,
    CASE WHEN p_accept THEN 'Musteri teklifi kabul etti' ELSE 'Musteri teklifi reddetti' END,
    jsonb_build_object('accepted', p_accept));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.respond_sell_phone_offer(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_sell_phone_offer(uuid, boolean) TO authenticated;

-- Müşterinin talebini doğrudan güncellemesini kapat (yalnızca RPC üzerinden)
DROP POLICY IF EXISTS "sell_phone_update_own" ON public.sell_phone_requests;

-- ============================================================
-- 4. update_delivery_status: satış alımını da tamamla
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

  -- Sipariş dışı kayıtlar (takas / satış / servis evden alım)
  IF v_delivery.order_id IS NULL THEN
    IF p_status = 'DELIVERED' AND v_delivery.trade_in_id IS NOT NULL THEN
      UPDATE public.trade_ins SET status = 'COMPLETED', updated_at = now()
      WHERE id = v_delivery.trade_in_id AND status = 'APPROVED';
    END IF;
    IF p_status = 'DELIVERED' AND v_delivery.sell_phone_id IS NOT NULL THEN
      UPDATE public.sell_phone_requests SET status = 'COMPLETED', updated_at = now()
      WHERE id = v_delivery.sell_phone_id AND status = 'ACCEPTED';
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
REVOKE EXECUTE ON FUNCTION public.update_delivery_status(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_delivery_status(uuid, text, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
