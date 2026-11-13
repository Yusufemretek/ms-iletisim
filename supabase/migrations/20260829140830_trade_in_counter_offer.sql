/*
# Trade-in counter-offer system

1. Schema Changes
- Add `counter_offer numeric` column to `trade_ins` (admin's counter price).
- Add `counter_notes text` column (admin's notes for the counter).
- Add new status 'COUNTERED' for when admin sends a counter-offer.

2. RPC Changes
- `counter_trade_in(p_trade_id, p_counter_offer, p_counter_notes)`:
  Admin sends a counter-offer. Sets status to 'COUNTERED', stores the offer
  amount and notes. Notifies the customer.
- `respond_trade_counter(p_trade_id, p_accept)`:
  Customer accepts or rejects the counter-offer. If accepted, sets status to
  'APPROVED' and updates old_device_offer to the counter amount. If rejected,
  sets status back to 'PENDING' so admin can try again.

3. Security
- counter_trade_in: admin-only (is_admin check).
- respond_trade_counter: customer-only (user_id = auth.uid() check).
*/

ALTER TABLE public.trade_ins
  ADD COLUMN IF NOT EXISTS counter_offer numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counter_notes text;

-- Function: Admin sends a counter-offer
CREATE OR REPLACE FUNCTION public.counter_trade_in(
  p_trade_id uuid,
  p_counter_offer numeric,
  p_counter_notes text DEFAULT NULL
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
    RAISE EXCEPTION 'Bu takas icin islem yapilamaz';
  END IF;

  UPDATE public.trade_ins
  SET counter_offer = p_counter_offer,
      counter_notes = COALESCE(p_counter_notes, counter_notes),
      status = 'COUNTERED',
      updated_at = now()
  WHERE id = p_trade_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'TRADE_IN_COUNTER', 'TRADE_IN', p_trade_id,
    'Takas karsi teklif gonderildi',
    jsonb_build_object('counter_offer', p_counter_offer));

  -- Notify customer
  IF v_trade.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, trade_in_id)
    VALUES (v_trade.user_id, 'Takas Karşı Teklifi',
      COALESCE(v_trade.old_device_brand, '') || ' ' || COALESCE(v_trade.old_device_model, '') || ' için karşı teklif: ' || p_counter_offer || ' TL',
      'trade_in', p_trade_id);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.counter_trade_in(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.counter_trade_in(uuid, numeric, text) TO authenticated;

-- Function: Customer accepts or rejects a counter-offer
CREATE OR REPLACE FUNCTION public.respond_trade_counter(
  p_trade_id uuid,
  p_accept boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade public.trade_ins%ROWTYPE;
BEGIN
  SELECT * INTO v_trade FROM public.trade_ins WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Takas kaydi bulunamadi';
  END IF;

  IF v_trade.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  IF v_trade.status != 'COUNTERED' THEN
    RAISE EXCEPTION 'Bu takas icin karsi teklif beklenmiyor';
  END IF;

  IF p_accept THEN
    UPDATE public.trade_ins
    SET status = 'APPROVED',
        old_device_offer = counter_offer,
        remaining_amount = new_product_price - counter_offer,
        updated_at = now()
    WHERE id = p_trade_id;
  ELSE
    UPDATE public.trade_ins
    SET status = 'PENDING',
        updated_at = now()
    WHERE id = p_trade_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description, new_values)
  VALUES (auth.uid(), 'TRADE_IN_COUNTER_RESPOND', 'TRADE_IN', p_trade_id,
    CASE WHEN p_accept THEN 'Musteri karsi teklifi kabul etti' ELSE 'Musteri karsi teklifi reddetti' END,
    jsonb_build_object('accepted', p_accept));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.respond_trade_counter(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_trade_counter(uuid, boolean) TO authenticated;
