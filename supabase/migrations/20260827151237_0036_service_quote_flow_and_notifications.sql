/*
# Service Quote Flow & Notification Improvements

## Purpose
1. Add `service_id` column to `notifications` table so notifications can link to service records
2. Add `trade_in_id` column to `notifications` table so notifications can link to trade-in records
3. Update `update_service_status` RPC to send Turkish notifications to the customer when status changes
4. Create new `respond_to_service_quote` RPC that lets customers accept or reject a service quote
5. Update `create_notification` RPC to accept service_id and trade_in_id parameters

## Changes to `notifications` table
- Add `service_id uuid` column (nullable, references service_records)
- Add `trade_in_id uuid` column (nullable, references trade_ins)

## Changes to `update_service_status` function
- Now sends a Turkish notification to the service record owner when status changes
- Notification title and message are in Turkish, no English enum values shown
- Maps each status to a human-readable Turkish message

## New function: `respond_to_service_quote`
- Allows the customer (service record owner) to accept or reject a quote
- Only works when current status is QUOTED
- Sets status to APPROVED (accept) or REJECTED (reject)
- Sends notification to all admin users

## Changes to `create_notification` function
- Accepts optional `p_service_id` and `p_trade_in_id` parameters

## Security
- `respond_to_service_quote` is SECURITY DEFINER, checks ownership via auth.uid()
- Only the service record owner can respond to their quote
*/

-- Add service_id and trade_in_id columns to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.service_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS trade_in_id uuid REFERENCES public.trade_ins(id) ON DELETE CASCADE;

-- Update create_notification to accept service_id and trade_in_id
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text DEFAULT NULL,
  p_type text DEFAULT 'info',
  p_order_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_trade_in_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, order_id, service_id, trade_in_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_order_id, p_service_id, p_trade_in_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid, uuid) TO authenticated;

-- Update update_service_status to send Turkish notifications
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
  v_service public.service_records%ROWTYPE;
  v_notif_title text;
  v_notif_msg text;
  v_admin_user record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_service FROM public.service_records WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servis kaydi bulunamadi';
  END IF;

  v_current_status := v_service.status;

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

  -- Send Turkish notification to customer when status changes
  IF v_current_status != p_status AND v_service.user_id IS NOT NULL THEN
    v_notif_title := 'Servis Durumu Güncellendi';
    v_notif_msg := CASE p_status
      WHEN 'RECEIVED' THEN 'Servis kaydınız başarıyla oluşturuldu.'
      WHEN 'QUOTED' THEN v_service.service_number || ' numaralı servis kaydınız için fiyat teklifi hazır.'
      WHEN 'APPROVED' THEN 'Servis teklifiniz onaylandı.'
      WHEN 'REJECTED' THEN 'Servis teklifiniz reddedildi.'
      WHEN 'IN_PROGRESS' THEN 'Cihazınızın servis işlemi başladı.'
      WHEN 'COMPLETED' THEN 'Cihazınızın servis işlemi tamamlandı.'
      WHEN 'DELIVERED' THEN 'Cihazınız teslim edildi.'
      WHEN 'PAID' THEN 'Servis ücreti tahsil edildi.'
      WHEN 'CANCELLED' THEN 'Servis kaydınız iptal edildi.'
      ELSE 'Servis kaydınızın durumu güncellendi.'
    END;

    PERFORM public.create_notification(
      v_service.user_id,
      v_notif_title,
      v_notif_msg,
      'service',
      NULL,
      p_service_id,
      NULL
    );
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_service_status(uuid, text, numeric, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_service_status(uuid, text, numeric, numeric, numeric, text) TO authenticated;

-- New function: customer responds to service quote (accept/reject)
CREATE OR REPLACE FUNCTION public.respond_to_service_quote(
  p_service_id uuid,
  p_response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.service_records%ROWTYPE;
  v_new_status text;
  v_admin_user record;
BEGIN
  -- Validate response
  IF p_response NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Geçersiz yanıt: accept veya reject olmalıdır';
  END IF;

  -- Get service record and verify ownership
  SELECT * INTO v_service FROM public.service_records WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servis kaydi bulunamadi';
  END IF;

  IF v_service.user_id IS NULL OR v_service.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Bu servis kaydına yetkiniz yok';
  END IF;

  -- Only allow response when status is QUOTED
  IF v_service.status != 'QUOTED' THEN
    RAISE EXCEPTION 'Bu servis kaydı için teklif yanıtı verilemez';
  END IF;

  v_new_status := CASE WHEN p_response = 'accept' THEN 'APPROVED' ELSE 'REJECTED' END;

  UPDATE public.service_records SET
    status = v_new_status,
    approved_at = CASE WHEN p_response = 'accept' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id = p_service_id;

  -- Notify all admins
  FOR v_admin_user IN SELECT user_id FROM public.admins
  LOOP
    PERFORM public.create_notification(
      v_admin_user.user_id,
      'Servis Teklif Yanıtı',
      v_service.service_number || ' numaralı servis kaydı teklifi ' || CASE WHEN p_response = 'accept' THEN 'onaylandı' ELSE 'reddedildi' END || '.',
      'service',
      NULL,
      p_service_id,
      NULL
    );
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.respond_to_service_quote(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_service_quote(uuid, text) TO authenticated;
