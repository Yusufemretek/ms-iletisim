/*
# MS İletişim - Genişletilmiş Platform RPC Fonksiyonları

## Genel Açıklama
2. el cihaz satışı, telefon sat teklifi, takas onayı, canlı destek mesajı, favori ekleme/silme, sadakat puanı ekleme ve servis parça kullanımı için SECURITY DEFINER fonksiyonlar.

## Yeni Fonksiyonlar
1. sell_used_device - 2. el cihaz satışı (status -> sold)
2. update_sell_phone_offer - Admin telefon sat teklifi güncelle
3. approve_trade_in - Takas onayla (stok düş + sipariş oluştur)
4. send_chat_message - Canlı destek mesajı gönder
5. toggle_favorite - Favori ekle/sil
6. add_loyalty_points - Sadakat puanı ekle
7. use_service_part - Serviste stoktan parça kullan (stok düş + maliyet ekle)
8. get_store_settings - Mağaza ayarlarını getir
9. update_store_settings - Mağaza ayarlarını güncelle
*/

-- ============================================================
-- 1. SELL_USED_DEVICE - 2. El Cihaz Satışı
-- ============================================================
CREATE OR REPLACE FUNCTION public.sell_used_device(
  p_device_id uuid,
  p_payment_method text DEFAULT 'cash',
  p_customer_name text DEFAULT 'Walk-in Customer'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device public.used_devices%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
  v_count integer;
  v_cash_after numeric;
  v_bank_after numeric;
  v_card_after numeric;
  v_profit numeric;
  v_item_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_device FROM public.used_devices WHERE id = p_device_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cihaz bulunamadi';
  END IF;

  IF v_device.status != 'available' THEN
    RAISE EXCEPTION 'Cihaz satilamaz (durum: %)', v_device.status;
  END IF;

  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.orders WHERE created_at::date = now()::date;
  v_order_number := 'USED-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');

  v_profit := v_device.sale_price - v_device.purchase_price;

  INSERT INTO public.orders (
    order_number, user_id, customer_name, customer_phone, customer_email,
    status, payment_method, payment_status, total, subtotal, discount,
    sales_channel, delivery_type
  ) VALUES (
    v_order_number, NULL, p_customer_name, NULL, 'walkin@ms-iletisim.com',
    'delivered', p_payment_method, 'paid', v_device.sale_price, v_device.sale_price, 0,
    'POS', 'GEL_AL'
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, product_name, brand, model, unit_price, quantity, subtotal,
    cost_price, product_snapshot, imei
  ) VALUES (
    v_order_id, NULL, v_device.brand || ' ' || v_device.model,
    v_device.brand, v_device.model, v_device.sale_price, 1, v_device.sale_price,
    v_device.purchase_price, to_jsonb(v_device), v_device.imei
  ) RETURNING id INTO v_item_id;

  INSERT INTO public.sales (
    order_id, order_item_id, product_name, cost_price, sale_price,
    quantity, total_sale, profit, payment_method
  ) VALUES (
    v_order_id, v_item_id, v_device.brand || ' ' || v_device.model,
    v_device.purchase_price, v_device.sale_price, 1,
    v_device.sale_price, v_profit, p_payment_method
  );

  INSERT INTO public.payments (order_id, payment_method, amount, status, collected_by, collected_at)
  VALUES (v_order_id, p_payment_method, v_device.sale_price, 'COMPLETED', auth.uid(), now());

  IF p_payment_method IN ('cash', 'cash_on_delivery') THEN
    v_cash_after := public.get_cash_balance() + v_device.sale_price;
    INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_device.sale_price, 'IN', v_cash_after, 'SALE', v_order_id, '2. el satis - ' || v_order_number);
  ELSIF p_payment_method IN ('bank_transfer', 'havale') THEN
    v_bank_after := public.get_bank_balance() + v_device.sale_price;
    INSERT INTO public.bank_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_device.sale_price, 'IN', v_bank_after, 'SALE', v_order_id, '2. el satis - ' || v_order_number);
  ELSIF p_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
    v_card_after := public.get_card_balance() + v_device.sale_price;
    INSERT INTO public.card_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_device.sale_price, 'IN', v_card_after, 'SALE', v_order_id, '2. el satis - ' || v_order_number);
  END IF;

  UPDATE public.used_devices SET status = 'sold', updated_at = now() WHERE id = p_device_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'SELL_USED_DEVICE', 'USED_DEVICE', p_device_id, '2. el cihaz satildi',
    jsonb_build_object('order_id', v_order_id, 'price', v_device.sale_price, 'profit', v_profit));

  RETURN v_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sell_used_device(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_used_device(uuid, text, text) TO authenticated;

-- ============================================================
-- 2. UPDATE_SELL_PHONE_OFFER - Admin Teklif Güncelle
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_sell_phone_offer(
  p_request_id uuid,
  p_offer_price numeric,
  p_status text,
  p_admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  UPDATE public.sell_phone_requests
  SET offer_price = p_offer_price,
      status = p_status,
      admin_notes = COALESCE(p_admin_notes, admin_notes),
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'SELL_PHONE_OFFER', 'SELL_PHONE_REQUEST', p_request_id,
    'Telefon satis teklifi guncellendi',
    jsonb_build_object('offer', p_offer_price, 'status', p_status));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_sell_phone_offer(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_sell_phone_offer(uuid, numeric, text, text) TO authenticated;

-- ============================================================
-- 3. APPROVE_TRADE_IN - Takas Onayla
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

  IF v_trade.status != 'PENDING' THEN
    RAISE EXCEPTION 'Bu takas icin zaten islem yapilmis';
  END IF;

  IF p_approved THEN
    UPDATE public.trade_ins SET status = 'APPROVED', updated_at = now() WHERE id = p_trade_id;
  ELSE
    UPDATE public.trade_ins SET status = 'REJECTED', updated_at = now() WHERE id = p_trade_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'TRADE_IN_APPROVE', 'TRADE_IN', p_trade_id,
    'Takas onaylandi/reddedildi',
    jsonb_build_object('approved', p_approved));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_trade_in(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_trade_in(uuid, boolean) TO authenticated;

-- ============================================================
-- 4. SEND_CHAT_MESSAGE - Canlı Destek Mesajı
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_sender_type text,
  p_message text DEFAULT NULL,
  p_image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg_id uuid;
  v_conv public.chat_conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM public.chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konusma bulunamadi';
  END IF;

  IF p_sender_type = 'customer' THEN
    IF v_conv.user_id != auth.uid() THEN
      RAISE EXCEPTION 'Yetkisiz';
    END IF;
  ELSIF p_sender_type = 'admin' THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Yetkisiz';
    END IF;
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender_type, message, image_url)
  VALUES (p_conversation_id, p_sender_type, p_message, p_image_url)
  RETURNING id INTO v_msg_id;

  UPDATE public.chat_conversations
  SET last_message_at = now(),
      status = CASE WHEN p_sender_type = 'customer' THEN 'WAITING_REPLY' ELSE 'OPEN' END,
      updated_at = now()
  WHERE id = p_conversation_id;

  IF p_sender_type = 'customer' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT '00000000-0000-0000-0000-000000000000', 'Yeni Destek Mesaji', COALESCE(p_message, 'Resim gonderildi'), 'support'
    WHERE NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = '00000000-0000-0000-0000-000000000000');
  END IF;

  RETURN v_msg_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, text) TO authenticated;

-- ============================================================
-- 5. TOGGLE_FAVORITE - Favori Ekle/Sil
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_favorite(
  p_product_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_price numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Giris yapmalisiniz';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.favorites WHERE user_id = auth.uid() AND product_id = p_product_id) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.favorites WHERE user_id = auth.uid() AND product_id = p_product_id;
    RETURN false;
  ELSE
    SELECT sale_price INTO v_price FROM public.products WHERE id = p_product_id;
    INSERT INTO public.favorites (user_id, product_id, price_at_favorite)
    VALUES (auth.uid(), p_product_id, v_price);
    RETURN true;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_favorite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(uuid) TO authenticated;

-- ============================================================
-- 6. ADD_LOYALTY_POINTS - Sadakat Puanı Ekle
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_loyalty_points(
  p_user_id uuid,
  p_points integer,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  INSERT INTO public.loyalty_points (user_id, points, total_earned)
  VALUES (p_user_id, p_points, GREATEST(p_points, 0))
  ON CONFLICT (user_id)
  DO UPDATE SET
    points = loyalty_points.points + p_points,
    total_earned = loyalty_points.total_earned + GREATEST(p_points, 0),
    updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_loyalty_points(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points(uuid, integer, text) TO authenticated;

-- ============================================================
-- 7. USE_SERVICE_PART - Serviste Stoktan Parça Kullan
-- ============================================================
CREATE OR REPLACE FUNCTION public.use_service_part(
  p_service_id uuid,
  p_product_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_service public.service_records%ROWTYPE;
  v_prev_stock integer;
  v_new_stock integer;
  v_part_cost numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Urun bulunamadi';
  END IF;

  IF v_product.stock < p_quantity THEN
    RAISE EXCEPTION 'Yetersiz stok: %', v_product.name;
  END IF;

  SELECT * INTO v_service FROM public.service_records WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servis kaydi bulunamadi';
  END IF;

  v_part_cost := v_product.cost_price * p_quantity;
  v_prev_stock := v_product.stock;
  v_new_stock := v_prev_stock - p_quantity;

  UPDATE public.products SET stock = v_new_stock WHERE id = p_product_id;

  UPDATE public.service_records
  SET parts_cost = parts_cost + v_part_cost,
      service_price = CASE WHEN service_price = 0 THEN v_part_cost ELSE service_price END,
      updated_at = now()
  WHERE id = p_service_id;

  INSERT INTO public.service_parts (service_id, part_name, cost_price, quantity)
  VALUES (p_service_id, v_product.name, v_product.cost_price, p_quantity);

  INSERT INTO public.stock_movements (
    product_id, movement_type, quantity, previous_stock, new_stock,
    reference_type, reference_id, notes
  ) VALUES (
    p_product_id, 'SERVICE_USAGE', -p_quantity, v_prev_stock, v_new_stock,
    'SERVICE', p_service_id, 'Servis parca kullanimi: ' || v_product.name
  );

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'USE_SERVICE_PART', 'SERVICE', p_service_id, 'Serviste parca kullanildi',
    jsonb_build_object('product', v_product.name, 'qty', p_quantity, 'cost', v_part_cost));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.use_service_part(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_service_part(uuid, uuid, integer) TO authenticated;

-- ============================================================
-- 8. GET_STORE_SETTINGS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_store_settings()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(t) FROM (
    SELECT store_name, store_subtitle, logo_url, phone, email, address, city, district,
           working_hours, whatsapp, courier_fee, pos_commission_rate, tax_rate,
           low_stock_threshold, loyalty_rate
    FROM public.store_settings WHERE id = 1
  ) t;
$$;
REVOKE EXECUTE ON FUNCTION public.get_store_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_settings() TO anon, authenticated;

-- ============================================================
-- 9. UPDATE_STORE_SETTINGS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_store_settings(
  p_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  UPDATE public.store_settings SET
    store_name = COALESCE(p_settings->>'store_name', store_name),
    store_subtitle = COALESCE(p_settings->>'store_subtitle', store_subtitle),
    logo_url = COALESCE(p_settings->>'logo_url', logo_url),
    phone = COALESCE(p_settings->>'phone', phone),
    email = COALESCE(p_settings->>'email', email),
    address = COALESCE(p_settings->>'address', address),
    city = COALESCE(p_settings->>'city', city),
    district = COALESCE(p_settings->>'district', district),
    working_hours = COALESCE(p_settings->>'working_hours', working_hours),
    whatsapp = COALESCE(p_settings->>'whatsapp', whatsapp),
    courier_fee = COALESCE((p_settings->>'courier_fee')::numeric, courier_fee),
    pos_commission_rate = COALESCE((p_settings->>'pos_commission_rate')::numeric, pos_commission_rate),
    tax_rate = COALESCE((p_settings->>'tax_rate')::numeric, tax_rate),
    low_stock_threshold = COALESCE((p_settings->>'low_stock_threshold')::integer, low_stock_threshold),
    loyalty_rate = COALESCE((p_settings->>'loyalty_rate')::numeric, loyalty_rate),
    updated_at = now()
  WHERE id = 1;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description)
  VALUES (auth.uid(), 'UPDATE_SETTINGS', 'STORE_SETTINGS', 1, 'Magaza ayarlari guncellendi');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_store_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_store_settings(jsonb) TO authenticated;
