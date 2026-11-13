/*
# Production Fixes: create_sale stock race + price manipulation + anon security

## Changes:
1. create_sale: Add FOR UPDATE lock on product row to prevent TOCTOU
2. create_sale: Always use server-side sale_price, ignore client-supplied unit_price
3. create_sale: Atomic stock decrement with zero-floor guard
4. Revoke EXECUTE on SECURITY DEFINER functions from anon role
*/

-- ============================================================
-- 1. Fix create_sale: atomic stock + server-side price
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
  v_rows_affected integer;
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

  IF v_installment_count IS NOT NULL AND v_installment_count != 1 THEN
    SELECT * INTO v_settings FROM public.installment_settings WHERE installment_count = v_installment_count;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Gecersiz taksit sayisi: %', v_installment_count;
    END IF;
    IF v_settings.is_active = false THEN
      RAISE EXCEPTION 'Bu taksit su anda aktif degil: %', v_installment_count;
    END IF;

    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_payment_method := v_payment->>'payment_method';
      IF v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
        v_is_card_payment := true;
      END IF;
    END LOOP;

    IF NOT v_is_card_payment THEN
      RAISE EXCEPTION 'Taksit yalnizca kredi karti ile yapilabilir.';
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

    -- Lock the product row to prevent concurrent TOCTOU
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid FOR UPDATE;
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

    -- Always use server-side price, ignore client-supplied unit_price
    v_unit := v_product.sale_price;
    v_discount_item := COALESCE((v_item->>'discount')::numeric, 0);
    v_subtotal := (v_unit * v_qty) - v_discount_item;
    v_total := v_total + v_subtotal;

    v_prev_stock := v_product.stock;
    v_new_stock := v_prev_stock - v_qty;

    -- Atomic stock decrement with zero-floor guard
    UPDATE public.products SET stock = v_new_stock WHERE id = v_product.id AND stock >= v_qty;
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected = 0 THEN
      RAISE EXCEPTION 'Yetersiz stok: %', v_product.name;
    END IF;

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

  IF v_installment_count > 1 AND v_interest_rate > 0 THEN
    v_interest_amount := ROUND(v_total * v_interest_rate, 2);
    v_customer_total := v_total + v_interest_amount;
  ELSE
    v_customer_total := v_total;
  END IF;

  v_monthly_amount := CASE WHEN v_installment_count > 0 THEN ROUND(v_customer_total / v_installment_count, 2) ELSE v_customer_total END;

  IF v_is_card_payment THEN
    v_commission_amount := ROUND(v_customer_total * v_commission_rate, 2);
  END IF;

  v_net_amount := v_customer_total - v_commission_amount;

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

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_method := v_payment->>'payment_method';
    v_pay_amount := COALESCE((v_payment->>'amount')::numeric, v_customer_total);

    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      CONTINUE;
    END IF;

    v_total_payments := v_total_payments + v_pay_amount;

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

-- ============================================================
-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.assign_courier(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_consent_preferences(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_order_status(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_delivery_status(uuid, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_service_status(uuid, text, numeric, numeric, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_service_quote(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_service_sale(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_sell_phone_offer(uuid, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_trade_in(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_operator_campaign(uuid) FROM anon;
