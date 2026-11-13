/*
# MS İletişim - Merkezi Satış Motoru ve Finansal RPC Fonksiyonları

## Genel Açıklama
Tüm satış kanallarını (POS, ONLINE, KURYE, GEL_AL, SERVIS) tek bir merkezi sistem üzerinden yöneten SECURITY DEFINER fonksiyonlar. Atomik transaction, çift kayıt koruması, stok hareketi, finans hesap hareketleri ve kâr hesaplaması içerir.

## Yeni Fonksiyonlar
1. create_sale - Merkezi satış (POS/online/kurye/gel-al/servis)
2. add_payment - Mevcut siparişe ek ödeme ekle (parçalı ödeme)
3. process_return - İade işlemini atomik olarak gerçekleştir
4. run_daily_closing - Gün sonu: kart komisyonu hesapla, bankaya aktar (idempotent)
5. add_expense - Gider ekle ve ilgili finans hesabından düş
6. get_financial_summary - Finansal özet
7. create_service_sale - Servis tamamlandığında satış ve tahsilat oluştur
8. assign_courier - Kurye ataması yap
9. update_delivery_status - Teslimat durumu güncelle (teslimde tahsilat dahil)
10. update_service_status - Servis durumu güncelle
11. get_cash_balance / get_bank_balance / get_card_balance - Bakiye yardımcıları
*/

-- ============================================================
-- Yardımcı: Güncel kasa/banka/kart bakiyesi
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_cash_balance()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
  FROM public.cash_transactions;
$$;
REVOKE EXECUTE ON FUNCTION public.get_cash_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cash_balance() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_bank_balance()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
  FROM public.bank_transactions;
$$;
REVOKE EXECUTE ON FUNCTION public.get_bank_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bank_balance() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_card_balance()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
  FROM public.card_transactions;
$$;
REVOKE EXECUTE ON FUNCTION public.get_card_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_card_balance() TO authenticated;

-- ============================================================
-- 1. CREATE_SALE - Merkezi Satış Motoru
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
  p_discount numeric DEFAULT 0
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

  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.orders WHERE created_at::date = now()::date;
  v_order_number := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');

  INSERT INTO public.orders (
    order_number, user_id, address_id, customer_name, customer_phone, customer_email,
    status, payment_method, payment_status, note, total, subtotal, discount,
    sales_channel, delivery_type, delivery_slot_id
  ) VALUES (
    v_order_number, COALESCE(p_user_id, auth.uid()), p_address_id, p_customer_name, p_customer_phone, p_customer_email,
    'new', 'mixed', 'pending', p_note, 0, 0, p_discount,
    p_sales_channel, p_delivery_type, p_delivery_slot_id
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
  UPDATE public.orders SET total = v_total, subtotal = v_total + p_discount WHERE id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_method := v_payment->>'payment_method';
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      CONTINUE;
    END IF;

    v_total_payments := v_total_payments + v_pay_amount;

    INSERT INTO public.payments (order_id, payment_method, amount, status, collected_by, collected_at)
    VALUES (v_order_id, v_payment_method, v_pay_amount, 'COMPLETED', auth.uid(), now());

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
      VALUES (v_pay_amount, 'IN', v_card_after, 'SALE', v_order_id, 'Kart satis - ' || v_order_number);
    END IF;
  END LOOP;

  IF v_total_payments >= v_total THEN
    UPDATE public.orders SET payment_status = 'paid', status = 'confirmed' WHERE id = v_order_id;
  ELSIF v_total_payments > 0 THEN
    UPDATE public.orders SET payment_status = 'partial' WHERE id = v_order_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'CREATE_SALE', 'ORDER', v_order_id, 'Satis olusturuldu: ' || v_order_number,
    jsonb_build_object('channel', p_sales_channel, 'total', v_total, 'payments', v_total_payments));

  RETURN v_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_sale(text, text, text, text, uuid, jsonb, jsonb, text, uuid, uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale(text, text, text, text, uuid, jsonb, jsonb, text, uuid, uuid, text, numeric) TO authenticated;

-- ============================================================
-- 2. ADD_PAYMENT - Ek ödeme ekle (parçalı ödeme)
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_payment(
  p_order_id uuid,
  p_payment_method text,
  p_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment_id uuid;
  v_total_paid numeric;
  v_cash_after numeric;
  v_bank_after numeric;
  v_card_after numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siparis bulunamadi';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Iptal edilmis siparise odeme eklenemez';
  END IF;

  INSERT INTO public.payments (order_id, payment_method, amount, status, collected_by, collected_at)
  VALUES (p_order_id, p_payment_method, p_amount, 'COMPLETED', auth.uid(), now())
  RETURNING id INTO v_payment_id;

  IF p_payment_method IN ('cash', 'cash_on_delivery') THEN
    v_cash_after := public.get_cash_balance() + p_amount;
    INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, payment_id, description)
    VALUES (p_amount, 'IN', v_cash_after, 'SALE', p_order_id, v_payment_id, 'Ek odeme - ' || v_order.order_number);
  ELSIF p_payment_method IN ('bank_transfer', 'havale') THEN
    v_bank_after := public.get_bank_balance() + p_amount;
    INSERT INTO public.bank_transactions (amount, direction, balance_after, source_type, source_id, payment_id, description)
    VALUES (p_amount, 'IN', v_bank_after, 'SALE', p_order_id, v_payment_id, 'Ek odeme - ' || v_order.order_number);
  ELSIF p_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
    v_card_after := public.get_card_balance() + p_amount;
    INSERT INTO public.card_transactions (amount, direction, balance_after, source_type, source_id, payment_id, description)
    VALUES (p_amount, 'IN', v_card_after, 'SALE', p_order_id, v_payment_id, 'Ek odeme - ' || v_order.order_number);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM public.payments WHERE order_id = p_order_id AND status = 'COMPLETED';

  IF v_total_paid >= v_order.total THEN
    UPDATE public.orders SET payment_status = 'paid' WHERE id = p_order_id;
    IF v_order.status = 'new' THEN
      UPDATE public.orders SET status = 'confirmed' WHERE id = p_order_id;
    END IF;
  ELSE
    UPDATE public.orders SET payment_status = 'partial' WHERE id = p_order_id;
  END IF;

  RETURN v_payment_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_payment(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_payment(uuid, text, numeric) TO authenticated;

-- ============================================================
-- 3. PROCESS_RETURN - İade işlemi (atomik)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_return(
  p_order_id uuid,
  p_items jsonb,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return_id uuid;
  v_return_number text;
  v_count integer;
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_order_item public.order_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_refund numeric(12,2) := 0;
  v_prev_stock integer;
  v_new_stock integer;
  v_cash_after numeric;
  v_bank_after numeric;
  v_card_after numeric;
  v_total_refund numeric(12,2) := 0;
  v_payment public.payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siparis bulunamadi';
  END IF;

  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.returns WHERE created_at::date = now()::date;
  v_return_number := 'RET-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');

  INSERT INTO public.returns (order_id, return_number, reason, total_refund, status, processed_by)
  VALUES (p_order_id, v_return_number, p_reason, 0, 'COMPLETED', auth.uid())
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_order_item FROM public.order_items WHERE id = (v_item->>'order_item_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Siparis kalemi bulunamadi';
    END IF;

    v_refund := (v_item->>'refund_amount')::numeric;
    v_total_refund := v_total_refund + v_refund;

    INSERT INTO public.return_items (return_id, order_item_id, product_id, quantity, refund_amount, restock)
    VALUES (v_return_id, v_order_item.id, v_order_item.product_id, v_order_item.quantity, v_refund, COALESCE((v_item->>'restock')::boolean, true));

    IF COALESCE((v_item->>'restock')::boolean, true) AND v_order_item.product_id IS NOT NULL THEN
      SELECT * INTO v_product FROM public.products WHERE id = v_order_item.product_id;
      IF FOUND THEN
        v_prev_stock := v_product.stock;
        v_new_stock := v_prev_stock + v_order_item.quantity;
        UPDATE public.products SET stock = v_new_stock WHERE id = v_product.id;

        INSERT INTO public.stock_movements (
          product_id, movement_type, quantity, previous_stock, new_stock,
          order_id, reference_type, notes
        ) VALUES (
          v_product.id, 'IADE', v_order_item.quantity, v_prev_stock, v_new_stock,
          p_order_id, 'RETURN', 'Iade: ' || v_return_number
        );
      END IF;
    END IF;

    INSERT INTO public.sales (
      order_id, order_item_id, user_id, product_name, cost_price, sale_price,
      quantity, total_sale, profit, payment_method
    ) VALUES (
      p_order_id, v_order_item.id, v_order.user_id, 'IADE: ' || v_order_item.product_name,
      v_order_item.cost_price, v_order_item.unit_price, -v_order_item.quantity,
      -v_refund, -(v_refund - (v_order_item.cost_price * v_order_item.quantity)), v_order.payment_method
    );
  END LOOP;

  FOR v_payment IN SELECT * FROM public.payments WHERE order_id = p_order_id AND status = 'COMPLETED'
  LOOP
    IF v_payment.payment_method IN ('cash', 'cash_on_delivery') THEN
      v_cash_after := public.get_cash_balance() - v_payment.amount;
      INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, description)
      VALUES (v_payment.amount, 'OUT', v_cash_after, 'RETURN', v_return_id, 'Iade ters islem - ' || v_return_number);
    ELSIF v_payment.payment_method IN ('bank_transfer', 'havale') THEN
      v_bank_after := public.get_bank_balance() - v_payment.amount;
      INSERT INTO public.bank_transactions (amount, direction, balance_after, source_type, source_id, description)
      VALUES (v_payment.amount, 'OUT', v_bank_after, 'RETURN', v_return_id, 'Iade ters islem - ' || v_return_number);
    ELSIF v_payment.payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
      v_card_after := public.get_card_balance() - v_payment.amount;
      INSERT INTO public.card_transactions (amount, direction, balance_after, source_type, source_id, description)
      VALUES (v_payment.amount, 'OUT', v_card_after, 'RETURN', v_return_id, 'Iade ters islem - ' || v_return_number);
    END IF;
  END LOOP;

  UPDATE public.returns SET total_refund = v_total_refund WHERE id = v_return_id;
  UPDATE public.orders SET status = 'cancelled' WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'PROCESS_RETURN', 'RETURN', v_return_id, 'Iade islendi: ' || v_return_number,
    jsonb_build_object('order_id', p_order_id, 'refund', v_total_refund));

  RETURN v_return_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.process_return(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_return(uuid, jsonb, text) TO authenticated;

-- ============================================================
-- 4. RUN_DAILY_CLOSING - Gün Sonu (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_daily_closing(
  p_closing_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closing_date date := COALESCE(p_closing_date, now()::date);
  v_existing_id uuid;
  v_cash_total numeric := 0;
  v_card_total numeric := 0;
  v_bank_total numeric := 0;
  v_total_sales numeric := 0;
  v_total_cost numeric := 0;
  v_gross_profit numeric := 0;
  v_pos_commission numeric := 0;
  v_expenses_total numeric := 0;
  v_net_profit numeric := 0;
  v_starting_cash numeric := 0;
  v_ending_cash numeric := 0;
  v_card_balance_before numeric := 0;
  v_card_transferred numeric := 0;
  v_closing_id uuid;
  v_prev_closing public.daily_closings%ROWTYPE;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT id INTO v_existing_id FROM public.daily_closings WHERE closing_date = v_closing_date;
  IF FOUND THEN
    RAISE EXCEPTION 'Bu tarih icin gun sonu zaten yapilmis: %', v_closing_date;
  END IF;

  SELECT * INTO v_prev_closing FROM public.daily_closings
  WHERE closing_date < v_closing_date ORDER BY closing_date DESC LIMIT 1;
  v_starting_cash := COALESCE(v_prev_closing.ending_cash, 0);

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0)
  INTO v_cash_in, v_cash_out
  FROM public.cash_transactions
  WHERE created_at::date = v_closing_date;

  v_cash_total := v_cash_in;

  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0)
  INTO v_card_total
  FROM public.card_transactions
  WHERE created_at::date = v_closing_date AND source_type = 'SALE';

  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0)
  INTO v_bank_total
  FROM public.bank_transactions
  WHERE created_at::date = v_closing_date AND source_type = 'SALE';

  SELECT
    COALESCE(SUM(total_sale), 0),
    COALESCE(SUM(profit), 0)
  INTO v_total_sales, v_gross_profit
  FROM public.sales
  WHERE created_at::date = v_closing_date AND quantity > 0;

  SELECT COALESCE(SUM(cost_price * quantity), 0)
  INTO v_total_cost
  FROM public.sales
  WHERE created_at::date = v_closing_date AND quantity > 0;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses_total
  FROM public.expenses
  WHERE created_at::date = v_closing_date;

  v_card_balance_before := public.get_card_balance();

  IF v_card_balance_before > 0 THEN
    v_pos_commission := ROUND(v_card_balance_before * 0.0099, 2);
    v_card_transferred := v_card_balance_before - v_pos_commission;
  END IF;

  v_net_profit := v_gross_profit - v_pos_commission - v_expenses_total;
  v_ending_cash := v_starting_cash + v_cash_in - v_cash_out;

  INSERT INTO public.daily_closings (
    closing_date, cash_total, card_total, bank_total,
    total_sales, total_cost, gross_profit, pos_commission, expenses_total, net_profit,
    starting_cash, ending_cash, card_balance_before, card_transferred_to_bank, processed_by
  ) VALUES (
    v_closing_date, v_cash_total, v_card_total, v_bank_total,
    v_total_sales, v_total_cost, v_gross_profit, v_pos_commission, v_expenses_total, v_net_profit,
    v_starting_cash, v_ending_cash, v_card_balance_before, v_card_transferred, auth.uid()
  ) RETURNING id INTO v_closing_id;

  IF v_card_balance_before > 0 THEN
    INSERT INTO public.card_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_card_balance_before, 'OUT', 0, 'DAILY_CLOSING', v_closing_id, 'Gun sonu kart aktarimi');

    INSERT INTO public.bank_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_card_transferred, 'IN', public.get_bank_balance() + v_card_transferred, 'DAILY_CLOSING', v_closing_id, 'Gun sonu kart aktarimi');

    INSERT INTO public.expenses (category, description, amount, payment_type, created_by)
    VALUES ('POS Komisyonu', 'Gun sonu POS komisyonu - ' || v_closing_date, v_pos_commission, 'KART', auth.uid());
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'DAILY_CLOSING', 'DAILY_CLOSING', v_closing_id, 'Gun sonu yapildi: ' || v_closing_date,
    jsonb_build_object('sales', v_total_sales, 'profit', v_net_profit, 'commission', v_pos_commission));

  RETURN v_closing_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_daily_closing(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_daily_closing(date) TO authenticated;

-- ============================================================
-- 5. ADD_EXPENSE - Gider ekle
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_expense(
  p_category text,
  p_description text,
  p_amount numeric,
  p_payment_type text DEFAULT 'KASA'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_cash_after numeric;
  v_bank_after numeric;
  v_card_after numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Gider tutari 0 dan buyuk olmalidir';
  END IF;

  INSERT INTO public.expenses (category, description, amount, payment_type, created_by)
  VALUES (p_category, p_description, p_amount, p_payment_type, auth.uid())
  RETURNING id INTO v_expense_id;

  IF p_payment_type = 'KASA' THEN
    v_cash_after := public.get_cash_balance() - p_amount;
    INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (p_amount, 'OUT', v_cash_after, 'EXPENSE', v_expense_id, 'Gider: ' || p_category);
  ELSIF p_payment_type = 'BANKA' THEN
    v_bank_after := public.get_bank_balance() - p_amount;
    INSERT INTO public.bank_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (p_amount, 'OUT', v_bank_after, 'EXPENSE', v_expense_id, 'Gider: ' || p_category);
  ELSIF p_payment_type = 'KART' THEN
    v_card_after := public.get_card_balance() - p_amount;
    INSERT INTO public.card_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (p_amount, 'OUT', v_card_after, 'EXPENSE', v_expense_id, 'Gider: ' || p_category);
  END IF;

  RETURN v_expense_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_expense(text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_expense(text, text, numeric, text) TO authenticated;

-- ============================================================
-- 6. GET_FINANCIAL_SUMMARY - Finansal özet
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_today date := now()::date;
  v_cash_balance numeric;
  v_bank_balance numeric;
  v_card_balance numeric;
  v_today_sales numeric;
  v_today_cost numeric;
  v_today_profit numeric;
  v_today_cash numeric;
  v_today_card numeric;
  v_today_bank numeric;
  v_today_expenses numeric;
  v_today_commission numeric;
  v_net_profit numeric;
  v_total_stock_value numeric;
  v_low_stock_count integer;
  v_pending_orders integer;
  v_pending_services integer;
  v_courier_deliveries integer;
BEGIN
  v_cash_balance := public.get_cash_balance();
  v_bank_balance := public.get_bank_balance();
  v_card_balance := public.get_card_balance();

  SELECT COALESCE(SUM(total_sale), 0), COALESCE(SUM(profit), 0), COALESCE(SUM(cost_price * quantity), 0)
  INTO v_today_sales, v_today_profit, v_today_cost
  FROM public.sales WHERE created_at::date = v_today AND quantity > 0;

  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0)
  INTO v_today_cash
  FROM public.cash_transactions WHERE created_at::date = v_today AND source_type = 'SALE';

  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0)
  INTO v_today_card
  FROM public.card_transactions WHERE created_at::date = v_today AND source_type = 'SALE';

  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0)
  INTO v_today_bank
  FROM public.bank_transactions WHERE created_at::date = v_today AND source_type = 'SALE';

  SELECT COALESCE(SUM(amount), 0) INTO v_today_expenses
  FROM public.expenses WHERE created_at::date = v_today;

  SELECT COALESCE(SUM(amount), 0) INTO v_today_commission
  FROM public.expenses WHERE created_at::date = v_today AND category = 'POS Komisyonu';

  v_net_profit := v_today_profit - v_today_expenses;

  SELECT COALESCE(SUM(cost_price * stock), 0) INTO v_total_stock_value
  FROM public.products WHERE is_active = true;

  SELECT count(*) INTO v_low_stock_count
  FROM public.products WHERE is_active = true AND stock <= min_stock_level AND min_stock_level > 0;

  SELECT count(*) INTO v_pending_orders
  FROM public.orders WHERE status IN ('new', 'confirmed', 'preparing');

  SELECT count(*) INTO v_pending_services
  FROM public.service_records WHERE status IN ('RECEIVED', 'QUOTED', 'APPROVED', 'IN_PROGRESS');

  SELECT count(*) INTO v_courier_deliveries
  FROM public.deliveries WHERE status IN ('PENDING', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY');

  RETURN jsonb_build_object(
    'cash_balance', v_cash_balance,
    'bank_balance', v_bank_balance,
    'card_balance', v_card_balance,
    'today_sales', v_today_sales,
    'today_cost', v_today_cost,
    'today_profit', v_today_profit,
    'today_cash', v_today_cash,
    'today_card', v_today_card,
    'today_bank', v_today_bank,
    'today_expenses', v_today_expenses,
    'today_commission', v_today_commission,
    'net_profit', v_net_profit,
    'total_stock_value', v_total_stock_value,
    'low_stock_count', v_low_stock_count,
    'pending_orders', v_pending_orders,
    'pending_services', v_pending_services,
    'courier_deliveries', v_courier_deliveries
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_financial_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO authenticated;

-- ============================================================
-- 7. CREATE_SERVICE_SALE - Servis satışı
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_service_sale(
  p_service_id uuid,
  p_payment_method text DEFAULT 'cash'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.service_records%ROWTYPE;
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

  SELECT * INTO v_service FROM public.service_records WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servis kaydi bulunamadi';
  END IF;

  IF v_service.status NOT IN ('COMPLETED', 'DELIVERED') THEN
    RAISE EXCEPTION 'Servis tamamlanmamis';
  END IF;

  IF v_service.order_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bu servis icin zaten satis olusturulmus';
  END IF;

  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.orders WHERE created_at::date = now()::date;
  v_order_number := 'SRV-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');

  v_profit := v_service.service_price - v_service.parts_cost - v_service.labor_cost;

  INSERT INTO public.orders (
    order_number, user_id, customer_name, customer_phone, customer_email,
    status, payment_method, payment_status, total, subtotal, discount,
    sales_channel, delivery_type
  ) VALUES (
    v_order_number, v_service.user_id, v_service.customer_name, v_service.customer_phone, v_service.customer_email,
    'delivered', p_payment_method, 'paid', v_service.service_price, v_service.service_price, 0,
    'SERVIS', COALESCE(v_service.delivery_type, 'GEL_AL')
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, product_name, brand, model, unit_price, quantity, subtotal,
    cost_price, product_snapshot
  ) VALUES (
    v_order_id, NULL, 'Servis: ' || COALESCE(v_service.device_brand, '') || ' ' || COALESCE(v_service.device_model, ''),
    v_service.device_brand, v_service.device_model, v_service.service_price, 1, v_service.service_price,
    v_service.parts_cost + v_service.labor_cost,
    jsonb_build_object('type', 'service', 'service_id', p_service_id, 'parts_cost', v_service.parts_cost, 'labor_cost', v_service.labor_cost)
  ) RETURNING id INTO v_item_id;

  INSERT INTO public.sales (
    order_id, order_item_id, user_id, product_name, cost_price, sale_price,
    quantity, total_sale, profit, payment_method
  ) VALUES (
    v_order_id, v_item_id, v_service.user_id,
    'Servis: ' || COALESCE(v_service.device_brand, '') || ' ' || COALESCE(v_service.device_model, ''),
    v_service.parts_cost + v_service.labor_cost, v_service.service_price, 1,
    v_service.service_price, v_profit, p_payment_method
  );

  INSERT INTO public.payments (order_id, payment_method, amount, status, collected_by, collected_at)
  VALUES (v_order_id, p_payment_method, v_service.service_price, 'COMPLETED', auth.uid(), now());

  IF p_payment_method IN ('cash', 'cash_on_delivery') THEN
    v_cash_after := public.get_cash_balance() + v_service.service_price;
    INSERT INTO public.cash_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_service.service_price, 'IN', v_cash_after, 'SALE', v_order_id, 'Servis satisi - ' || v_order_number);
  ELSIF p_payment_method IN ('bank_transfer', 'havale') THEN
    v_bank_after := public.get_bank_balance() + v_service.service_price;
    INSERT INTO public.bank_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_service.service_price, 'IN', v_bank_after, 'SALE', v_order_id, 'Servis satisi - ' || v_order_number);
  ELSIF p_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
    v_card_after := public.get_card_balance() + v_service.service_price;
    INSERT INTO public.card_transactions (amount, direction, balance_after, source_type, source_id, description)
    VALUES (v_service.service_price, 'IN', v_card_after, 'SALE', v_order_id, 'Servis satisi - ' || v_order_number);
  END IF;

  UPDATE public.service_records
  SET order_id = v_order_id, paid_at = now(), status = 'PAID', updated_at = now()
  WHERE id = p_service_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'CREATE_SERVICE_SALE', 'ORDER', v_order_id, 'Servis satisi: ' || v_order_number,
    jsonb_build_object('service_id', p_service_id, 'profit', v_profit));

  RETURN v_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_service_sale(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_service_sale(uuid, text) TO authenticated;

-- ============================================================
-- 8. ASSIGN_COURIER - Kurye ataması
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_courier(
  p_order_id uuid,
  p_courier_id uuid
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

  UPDATE public.orders SET assigned_courier_id = p_courier_id WHERE id = p_order_id;

  IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = p_order_id) THEN
    INSERT INTO public.deliveries (order_id, courier_id, status, delivery_type)
    VALUES (p_order_id, p_courier_id, 'ASSIGNED',
      (SELECT delivery_type FROM public.orders WHERE id = p_order_id));
  ELSE
    UPDATE public.deliveries SET courier_id = p_courier_id, status = 'ASSIGNED'
    WHERE order_id = p_order_id AND status = 'PENDING';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assign_courier(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_courier(uuid, uuid) TO authenticated;

-- ============================================================
-- 9. UPDATE_DELIVERY_STATUS - Teslimat durumu güncelle
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
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_delivery_status(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_delivery_status(uuid, text, numeric) TO authenticated;

-- ============================================================
-- 10. UPDATE_SERVICE_STATUS - Servis durumu güncelle
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_service_status(
  p_service_id uuid,
  p_status text,
  p_service_price numeric DEFAULT NULL,
  p_parts_cost numeric DEFAULT NULL,
  p_labor_cost numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT status INTO v_current_status FROM public.service_records WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servis kaydi bulunamadi';
  END IF;

  UPDATE public.service_records SET
    status = p_status,
    service_price = COALESCE(p_service_price, service_price),
    parts_cost = COALESCE(p_parts_cost, parts_cost),
    labor_cost = COALESCE(p_labor_cost, labor_cost),
    notes = COALESCE(p_notes, notes),
    updated_at = now(),
    quoted_at = CASE WHEN p_status = 'QUOTED' AND v_current_status != 'QUOTED' THEN now() ELSE quoted_at END,
    approved_at = CASE WHEN p_status = 'APPROVED' AND v_current_status != 'APPROVED' THEN now() ELSE approved_at END,
    completed_at = CASE WHEN p_status = 'COMPLETED' AND v_current_status != 'COMPLETED' THEN now() ELSE completed_at END,
    delivered_at = CASE WHEN p_status = 'DELIVERED' AND v_current_status != 'DELIVERED' THEN now() ELSE delivered_at END
  WHERE id = p_service_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_service_status(uuid, text, numeric, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_service_status(uuid, text, numeric, numeric, numeric, text) TO authenticated;
