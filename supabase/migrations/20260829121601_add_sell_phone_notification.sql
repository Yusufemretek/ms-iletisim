/*
# Add sell_phone_id to notifications + notify customer on offer

1. Schema Changes
- Add `sell_phone_id uuid` column to `notifications` table so notifications
  can link to a sell phone request (same pattern as order_id, service_id, trade_in_id).

2. RPC Changes
- Update `update_sell_phone_offer` to insert a notification for the customer
  when admin sends/rejects an offer. The notification includes:
  - title: "Telefon Satış Teklifi" (offer) or "Teklif Güncellendi" (other)
  - message: brand + model + offer amount
  - type: 'sell_phone'
  - sell_phone_id: the request id
  - user_id: the request's user_id (if present)

3. Security
- No new policies needed; the INSERT into notifications is done via
  SECURITY DEFINER function (bypasses RLS for the insert).
*/

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sell_phone_id uuid;

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
DECLARE
  v_user_id uuid;
  v_brand text;
  v_model text;
  v_title text;
  v_message text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT user_id, brand, model INTO v_user_id, v_brand, v_model
  FROM public.sell_phone_requests WHERE id = p_request_id;

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

  -- Notify the customer if they have an account
  IF v_user_id IS NOT NULL THEN
    v_title := CASE WHEN p_status = 'OFFERED' THEN 'Telefon Satış Teklifiniz Hazır'
                    WHEN p_status = 'REJECTED' THEN 'Satış Talebiniz Reddedildi'
                    ELSE 'Satış Talebiniz Güncellendi' END;
    v_message := COALESCE(v_brand, '') || ' ' || COALESCE(v_model, '');
    IF p_status = 'OFFERED' AND p_offer_price > 0 THEN
      v_message := v_message || ' - Teklif: ' || p_offer_price || ' TL';
    ELSIF p_status = 'REJECTED' THEN
      v_message := v_message || ' - Talebiniz reddedildi.';
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, sell_phone_id)
    VALUES (v_user_id, v_title, v_message, 'sell_phone', p_request_id);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_sell_phone_offer(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_sell_phone_offer(uuid, numeric, text, text) TO authenticated;
