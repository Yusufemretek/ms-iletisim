/*
# Kredi Kartı Taksit Sistemi - RPC Fonksiyon Güncellemeleri

## Genel Açıklama
create_sale fonksiyonuna taksit parametresi ekler. Taksit yalnızca kredi kartı ödemelerinde kabul edilir.
Nakit, havale, IBAN ile taksit gönderilirse işlem reddedilir.

## Değişiklikler
1. create_sale fonksiyonuna p_installment_count parametresi eklendi (default NULL)
2. Ödeme işleminde taksit validasyonu: sadece card/card_on_delivery/online_card + installment_count kabul edilir
3. Taksit ayarlarından vade farkı ve komisyon oranı okunur
4. orders ve payments tablolarına taksit bilgileri yazılır
5. card_payment_details tablosuna kart ödeme detayı kaydedilir
6. Yeni fonksiyon: get_installment_options - müşteriye gösterilecek taksit seçeneklerini döndürür
7. Yeni fonksiyon: update_installment_settings - admin taksit ayarlarını günceller
*/

-- ============================================================
-- 1. GET_INSTALLMENT_OPTIONS - Müşteriye gösterilecek taksitler
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_installment_options(p_product_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'installment_count', i.installment_count,
    'label', i.label,
    'interest_rate', i.interest_rate,
    'commission_rate', i.commission_rate,
    'is_active', i.is_active
  ) ORDER BY i.sort_order), '[]'::jsonb)
  FROM public.installment_settings i
  WHERE i.is_active = true
    AND (p_product_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = p_product_id
        AND p.allowed_installments IS NOT NULL
        AND NOT (i.installment_count = ANY(p.allowed_installments))
    ));
$$;
REVOKE EXECUTE ON FUNCTION public.get_installment_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_installment_options(uuid) TO anon, authenticated;

-- ============================================================
-- 2. UPDATE_INSTALLMENT_SETTINGS - Admin taksit ayarı
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_installment_settings(
  p_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_count integer;
  v_active boolean;
  v_interest numeric;
  v_commission numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_settings)
  LOOP
    v_count := (v_item->>'installment_count')::integer;
    v_active := (v_item->>'is_active')::boolean;
    v_interest := COALESCE((v_item->>'interest_rate')::numeric, 0);
    v_commission := COALESCE((v_item->>'commission_rate')::numeric, 0.0099);

    UPDATE public.installment_settings
    SET is_active = v_active,
        interest_rate = v_interest,
        commission_rate = v_commission,
        updated_at = now()
    WHERE installment_count = v_count;
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description)
  VALUES (auth.uid(), 'UPDATE_INSTALLMENT', 'INSTALLMENT_SETTINGS', 0, 'Taksit ayarlari guncellendi');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_installment_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_installment_settings(jsonb) TO authenticated;

-- ============================================================
-- 3. CREATE_SALE - Taksit parametresi eklenerek güncellendi
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_sale(
  p_sales_channel text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_user_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_delivery_type text DEFAULT 'GEL_AL',
  p_delivery_slot_id uuid DEFAULT NULL,
  p_address_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_discount numeric DEFAULT 0,
  p_installment_count integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_product public.products%ROWTYPE;
  v_unit numeric(12,2);
  v_qty integer;
  v_discount_item numeric(12,2);
  v_subtotal numeric(12,2);
  v_total numeric(12,2) := 0;
  v_total_payments numeric(12,2) := 0;
  v_prev_stock integer;
  v_new_stock integer;
  v_imei text;
  v_addr public.addresses%ROWTYPE;
  v_payment_method text;
  v_pay_amount numeric(12,2);
  v_cash_after numeric;
  v_bank_after numeric;
  v_card_after numeric;
  v_order_number text;
  v_count integer;
  v_existing_count integer;
  v_installment_count integer := COALESCE(p_installment_count, 1);
  v_is_card_payment boolean := false;
  v_interest_rate numeric := 0;
  v_commission_rate numeric := 0.0099;
  v_interest_amount numeric := 0;
  v_customer_total numeric := 0;
  v_monthly_amount numeric := 0;
  v_commission_amount numeric := 0;
  v_net_amount numeric := 0;
  v_settings public.installment_settings%ROWTYPE;
  v_payment_id uuid;
  v_idempotency_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Satis icin giris yapmalisiniz';
  END IF;

  IF p_sales_channel = 'ONLINE' THEN
    IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
      RAISE EXCEPTION 'Gecersiz kullanici';
    END IF;
  ELSE
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Bu islem icin admin yetkisi gerekli';
    END IF;
  END IF;

  IF p_delivery_type = 'KURYE' AND p_address_id IS NOT NULL THEN
    SELECT * INTO v_addr FROM public.addresses WHERE id = p_address_id AND (user_id = p_user_id OR public.is_admin());
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Gecersiz adres';
    END IF;
  END IF;

  -- Taksit validasyonu
  IF v_installment_count IS NOT NULL AND v_installment_count != 1 THEN
    -- Taksit ayarını kontrol et
    SELECT * INTO v_settings FROM public.installment_settings WHERE installment_count = v_installment_count;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Gecersiz taksit sayisi: %', v_installment_count;
    END IF;
    IF v_settings.is_active = false THEN
      RAISE EXCEPTION 'Bu taksit su anda aktif degil: %', v_installment_count;
    END IF;

    -- Ödeme yöntemlerini kontrol et - taksit sadece kredi kartı ile
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_payment_method := v_payment->>'payment_method';
      IF v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
        v_is_card_payment := true;
      END IF;
    END LOOP;

    IF NOT v_is_card_payment THEN
      RAISE EXCEPTION 'Taksit yalnizca kredi karti ile yapilabilir. Secilen odeme yontemi taksit desteklemiyor.';
    END IF;

    v_interest_rate := v_settings.interest_rate;
    v_commission_rate := v_settings.commission_rate;
  END IF;

  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.orders WHERE created_at::date = now()::date;
  v_order_number := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');

  INSERT INTO public.orders (
    order_number, user_id, address_id, customer_name, customer_phone, customer_email,
    status, payment_method, payment_status, note, total, subtotal, discount,
    sales_channel, delivery_type, delivery_slot_id,
    installment_count, installment_monthly_amount, installment_total,
    interest_amount, pos_commission_amount, net_amount
  ) VALUES (
    v_order_number, COALESCE(p_user_id, auth.uid()), p_address_id, p_customer_name, p_customer_phone, p_customer_email,
    'new', 'mixed', 'pending', p_note, 0, 0, p_discount,
    p_sales_channel, p_delivery_type, p_delivery_slot_id,
    CASE WHEN v_installment_count > 1 THEN v_installment_count ELSE NULL END,
    NULL, NULL, 0, 0, 0
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Gecersiz adet';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Urun bulunamadi: %', v_item->>'product_id';
    END IF;

    IF v_product.is_active = false THEN
      RAISE EXCEPTION 'Pasif urun satilamaz: %', v_product.name;
    END IF;

    IF v_product.imei IS NOT NULL AND v_qty != 1 THEN
      RAISE EXCEPTION 'IMEI li cihaz tek adet satilabilir: %', v_product.name;
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Yetersiz stok: % (Mevcut: %, Istenen: %)', v_product.name, v_product.stock, v_qty;
    END IF;

    IF v_product.imei IS NOT NULL THEN
      SELECT count(*) INTO v_existing_count
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.imei = v_product.imei AND o.status != 'cancelled';
      IF v_existing_count > 0 THEN
        RAISE EXCEPTION 'Bu IMEI zaten satildi: %', v_product.imei;
      END IF;
    END IF;

    v_unit := COALESCE((v_item->>'unit_price')::numeric, v_product.sale_price);
    v_discount_item := COALESCE((v_item->>'discount')::numeric, 0);
    v_subtotal := (v_unit * v_qty) - v_discount_item;
    v_total := v_total + v_subtotal;

    v_prev_stock := v_product.stock;
    v_new_stock := v_prev_stock - v_qty;

    UPDATE public.products SET stock = v_new_stock WHERE id = v_product.id;

    v_imei := v_product.imei;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, brand, model, unit_price, quantity, subtotal,
      product_snapshot, cost_price, discount, imei
    ) VALUES (
      v_order_id, v_product.id, v_product.name, v_product.brand, v_product.model,
      v_unit, v_qty, v_subtotal, to_jsonb(v_product),
      v_product.cost_price, v_discount_item, v_imei
    );

    INSERT INTO public.stock_movements (
      product_id, movement_type, quantity, previous_stock, new_stock,
      order_id, user_id, reference_type, notes
    ) VALUES (
      v_product.id, 'SATIS', -v_qty, v_prev_stock, v_new_stock,
      v_order_id, auth.uid(), 'ORDER', v_product.name || ' satis'
    );
  END LOOP;

  v_total := v_total - p_discount;

  -- Taksit hesaplama
  IF v_installment_count > 1 AND v_interest_rate > 0 THEN
    v_interest_amount := ROUND(v_total * v_interest_rate, 2);
    v_customer_total := v_total + v_interest_amount;
  ELSE
    v_customer_total := v_total;
  END IF;

  v_monthly_amount := CASE WHEN v_installment_count > 0 THEN ROUND(v_customer_total / v_installment_count, 2) ELSE v_customer_total END;

  -- Komisyon hesaplama (kart ödemesinde)
  IF v_is_card_payment THEN
    v_commission_amount := ROUND(v_customer_total * v_commission_rate, 2);
  END IF;

  v_net_amount := v_customer_total - v_commission_amount;

  -- Sipariş güncelle
  UPDATE public.orders SET
    total = v_customer_total,
    subtotal = v_total + p_discount,
    installment_count = CASE WHEN v_installment_count > 1 THEN v_installment_count ELSE NULL END,
    installment_monthly_amount = CASE WHEN v_installment_count > 1 THEN v_monthly_amount ELSE NULL END,
    installment_total = CASE WHEN v_installment_count > 1 THEN v_customer_total ELSE NULL END,
    interest_amount = v_interest_amount,
    pos_commission_amount = v_commission_amount,
    net_amount = v_net_amount
  WHERE id = v_order_id;

  -- Ödemeleri işle
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_method := v_payment->>'payment_method';
    v_pay_amount := COALESCE((v_payment->>'amount')::numeric, v_customer_total);

    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      CONTINUE;
    END IF;

    v_total_payments := v_total_payments + v_pay_amount;

    -- Idempotency key
    v_idempotency_key := COALESCE(v_payment->>'idempotency_key', gen_random_uuid()::text);

    INSERT INTO public.payments (
      order_id, payment_method, amount, status, collected_by, collected_at,
      installment_count, installment_monthly_amount, installment_total,
      interest_amount, pos_commission_amount, net_amount,
      transaction_id, payment_provider, payment_status_detail
    ) VALUES (
      v_order_id, v_payment_method, v_pay_amount, 'COMPLETED', auth.uid(), now(),
      CASE WHEN v_installment_count > 1 AND v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN v_installment_count ELSE NULL END,
      CASE WHEN v_installment_count > 1 AND v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN v_monthly_amount ELSE NULL END,
      CASE WHEN v_installment_count > 1 AND v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN v_customer_total ELSE NULL END,
      CASE WHEN v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN v_interest_amount ELSE 0 END,
      CASE WHEN v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN v_commission_amount ELSE 0 END,
      CASE WHEN v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN v_net_amount ELSE v_pay_amount END,
      v_payment->>'transaction_id',
      v_payment->>'payment_provider',
      'COMPLETED'
    ) RETURNING id INTO v_payment_id;

    -- Kart ödemesi detayını kaydet
    IF v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
      INSERT INTO public.card_payment_details (
        payment_id, order_id, gross_amount, installment_count, interest_rate,
        interest_amount, customer_total, monthly_amount, commission_rate,
        commission_amount, net_amount, transaction_id, provider, masked_card,
        payment_status, idempotency_key
      ) VALUES (
        v_payment_id, v_order_id, v_total, v_installment_count, v_interest_rate,
        v_interest_amount, v_customer_total, v_monthly_amount, v_commission_rate,
        v_commission_amount, v_net_amount,
        v_payment->>'transaction_id',
        v_payment->>'payment_provider',
        v_payment->>'masked_card',
        'COMPLETED',
        v_idempotency_key
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    -- Finans hesabına aktar
    IF v_payment_method IN ('cash', 'cash_on_delivery') THEN
      v_cash_after := public.get_cash_balance() + v_pay_amount;
      INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, description)
      VALUES (v_pay_amount, 'IN', v_cash_after, 'SALE', v_order_id, 'Nakit satis - ' || v_order_number);
    ELSIF v_payment_method IN ('bank_transfer', 'havale') THEN
      v_bank_after := public.get_bank_balance() + v_pay_amount;
      INSERT INTO public.bank_transactions (amount, direction, balance_after, source_type, source_id, description)
      VALUES (v_pay_amount, 'IN', v_bank_after, 'SALE', v_order_id, 'Havale/EFT satis - ' || v_order_number);
    ELSIF v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
      v_card_after := public.get_card_balance() + v_pay_amount;
      INSERT INTO public.card_transactions (amount, direction, balance_after, source_type, source_id, description)
      VALUES (v_pay_amount, 'IN', v_card_after, 'SALE', v_order_id,
        'Kart satis - ' || v_order_number || CASE WHEN v_installment_count > 1 THEN ' (' || v_installment_count || ' taksit)' ELSE '' END);
    END IF;
  END LOOP;

  -- Ödeme durumu güncelle
  IF v_total_payments >= v_customer_total THEN
    UPDATE public.orders SET payment_status = 'paid', status = 'confirmed' WHERE id = v_order_id;
  ELSIF v_total_payments > 0 THEN
    UPDATE public.orders SET payment_status = 'partial' WHERE id = v_order_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'CREATE_SALE', 'ORDER', v_order_id, 'Satis olusturuldu: ' || v_order_number,
    jsonb_build_object('channel', p_sales_channel, 'total', v_customer_total, 'installment', v_installment_count, 'commission', v_commission_amount));

  RETURN v_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_sale(text, text, text, text, uuid, jsonb, jsonb, text, uuid, uuid, text, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale(text, text, text, text, uuid, jsonb, jsonb, text, uuid, uuid, text, numeric, integer) TO authenticated;
