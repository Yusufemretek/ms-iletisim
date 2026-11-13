/*
# Fix create_sale: image_url in order_items + proper payment_method

## Problem 1: order_items.image_url not populated
- The INSERT INTO order_items does not include image_url.
- New orders won't have product images.
- Fix: Look up primary product image and include it in the INSERT.

## Problem 2: payment_method hardcoded as 'mixed'
- The INSERT INTO orders uses 'mixed' as payment_method.
- This is the source of the "Karma Ödeme" label on the dashboard.
- Fix: Use the actual payment method from p_payments.

## Problem 3: installment_count parameter
- The function signature doesn't accept p_installment_count.
- The checkout page passes p_installment_count but the function ignores it.
- Fix: Add the parameter and use it.
*/

DROP FUNCTION IF EXISTS public.create_sale(
  text, text, text, text, uuid, jsonb, jsonb, text, uuid, uuid, text, numeric
);

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
  p_installment_count integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
  v_primary_image_url text;
  v_installment_count integer := COALESCE(p_installment_count, 1);
  v_interest_rate numeric := 0;
  v_commission_rate numeric := 0;
  v_is_card_payment boolean := false;
  v_interest_amount numeric(12,2) := 0;
  v_customer_total numeric(12,2);
  v_monthly_amount numeric(12,2);
  v_commission_amount numeric(12,2) := 0;
  v_net_amount numeric(12,2);
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

  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.orders WHERE created_at::date = now()::date;
  v_order_number := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');

  -- Get the first payment method to use as the order's payment_method
  v_payment_method := p_payments->0->>'payment_method';
  IF v_payment_method IS NULL THEN
    v_payment_method := 'cash';
  END IF;

  -- Check if it's a card payment for installment logic
  v_is_card_payment := v_payment_method IN ('card', 'card_on_delivery', 'online_card');

  -- Get installment settings if needed
  IF v_installment_count > 1 AND v_is_card_payment THEN
    SELECT interest_rate, commission_rate INTO v_interest_rate, v_commission_rate
    FROM public.installment_settings
    WHERE installment_count = v_installment_count AND is_active = true
    LIMIT 1;
  END IF;

  INSERT INTO public.orders (
    order_number, user_id, address_id, customer_name, customer_phone, customer_email,
    status, payment_method, payment_status, note, total, subtotal, discount,
    sales_channel, delivery_type, delivery_slot_id
  ) VALUES (
    v_order_number, COALESCE(p_user_id, auth.uid()), p_address_id, p_customer_name, p_customer_phone, p_customer_email,
    'new', v_payment_method, 'pending', p_note, 0, 0, p_discount,
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
    v_subtotal := (v_unit - v_discount_item) * v_qty;
    v_total := v_total + v_subtotal;

    IF v_item->>'imei' IS NOT NULL THEN
      v_imei := v_item->>'imei';
    ELSE
      v_imei := v_product.imei;
    END IF;

    v_prev_stock := v_product.stock;
    v_new_stock := v_prev_stock - v_qty;

    -- Get primary image for the product
    SELECT image_url INTO v_primary_image_url
    FROM public.product_images
    WHERE product_id = v_product.id AND is_primary = true
    LIMIT 1;

    IF v_primary_image_url IS NULL THEN
      SELECT image_url INTO v_primary_image_url
      FROM public.product_images
      WHERE product_id = v_product.id
      ORDER BY position ASC
      LIMIT 1;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, brand, model, unit_price, quantity, subtotal,
      product_snapshot, cost_price, discount, imei, image_url
    ) VALUES (
      v_order_id, v_product.id, v_product.name, v_product.brand, v_product.model,
      v_unit, v_qty, v_subtotal, to_jsonb(v_product),
      v_product.cost_price, v_discount_item, v_imei, v_primary_image_url
    );

    UPDATE public.products SET stock = v_new_stock WHERE id = v_product.id;

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
    ) RETURNING id INTO v_existing_count;

    v_payment_method := v_payment->>'payment_method';
    IF v_payment_method = 'cash' OR v_payment_method = 'cash_on_delivery' THEN
      SELECT cash_balance INTO v_cash_after FROM public.financial_balances WHERE id = 1;
      v_cash_after := COALESCE(v_cash_after, 0) + v_pay_amount;
      UPDATE public.financial_balances SET cash_balance = v_cash_after, updated_at = now() WHERE id = 1;
      IF NOT FOUND THEN
        INSERT INTO public.financial_balances (id, cash_balance) VALUES (1, v_pay_amount);
      END IF;
    ELSIF v_payment_method = 'bank' OR v_payment_method = 'bank_transfer' THEN
      SELECT bank_balance INTO v_bank_after FROM public.financial_balances WHERE id = 1;
      v_bank_after := COALESCE(v_bank_after, 0) + v_pay_amount;
      UPDATE public.financial_balances SET bank_balance = v_bank_after, updated_at = now() WHERE id = 1;
      IF NOT FOUND THEN
        INSERT INTO public.financial_balances (id, bank_balance) VALUES (1, v_pay_amount);
      END IF;
    ELSIF v_payment_method IN ('card', 'card_on_delivery', 'online_card') THEN
      SELECT card_balance INTO v_card_after FROM public.financial_balances WHERE id = 1;
      v_card_after := COALESCE(v_card_after, 0) + v_net_amount;
      UPDATE public.financial_balances SET card_balance = v_card_after, updated_at = now() WHERE id = 1;
      IF NOT FOUND THEN
        INSERT INTO public.financial_balances (id, card_balance) VALUES (1, v_net_amount);
      END IF;
    END IF;
  END LOOP;

  IF v_order.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (v_order_id, 'Siparişiniz Alındı',
    'Siparişiniz alınmıştır. Onaylandıktan sonra hazırlanmaya başlanacaktır.',
    'order', v_order_id);
  END IF;

  RETURN v_order_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_sale(
  text, text, text, text, uuid, jsonb, jsonb, text, uuid, uuid, text, numeric, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale(
  text, text, text, text, uuid, jsonb, jsonb, text, uuid, uuid, text, numeric, integer
) TO authenticated;

NOTIFY pgrst, 'reload schema';