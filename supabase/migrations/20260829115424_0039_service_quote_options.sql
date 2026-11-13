/*
# Service Quote Options - Multi-option quotes for service requests

## Changes:
1. New table `service_quote_options` — stores multiple quote options per service request
   - Each option has a name (e.g. "TFT Ekran", "OLED Ekran", "Orjinal Ekran"), price, parts cost, labor cost
   - Customer can select one option when responding to the quote
2. Add `selected_quote_option_id` column to `service_records` — tracks which option the customer chose
3. Update `update_service_status` RPC — accepts `p_quote_options` JSONB array to save multiple options
4. Update `respond_to_service_quote` RPC — accepts `p_selected_option_id` to record customer's choice
5. RLS policies on `service_quote_options` — customer can read options for their own service records, admin can read all
*/

-- ============================================================
-- 1. Create service_quote_options table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_quote_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  option_name text NOT NULL,
  service_price numeric(12,2) NOT NULL DEFAULT 0,
  parts_cost numeric(12,2) NOT NULL DEFAULT 0,
  labor_cost numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_quote_options ENABLE ROW LEVEL SECURITY;

-- Customer can read options for their own service records
DROP POLICY IF EXISTS "select_own_quote_options" ON public.service_quote_options;
CREATE POLICY "select_own_quote_options"
ON public.service_quote_options FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_records sr
    WHERE sr.id = service_id AND (sr.user_id = auth.uid() OR public.is_admin())
  )
);

-- Admin can insert/update/delete options
DROP POLICY IF EXISTS "admin_insert_quote_options" ON public.service_quote_options;
CREATE POLICY "admin_insert_quote_options"
ON public.service_quote_options FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_quote_options" ON public.service_quote_options;
CREATE POLICY "admin_update_quote_options"
ON public.service_quote_options FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_quote_options" ON public.service_quote_options;
CREATE POLICY "admin_delete_quote_options"
ON public.service_quote_options FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- 2. Add selected_quote_option_id to service_records
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_records' AND column_name = 'selected_quote_option_id'
  ) THEN
    ALTER TABLE public.service_records ADD COLUMN selected_quote_option_id uuid;
  END IF;
END $$;

-- ============================================================
-- 3. Update update_service_status to accept quote_options
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_service_status(
  p_service_id uuid,
  p_status text,
  p_service_price numeric DEFAULT NULL,
  p_parts_cost numeric DEFAULT NULL,
  p_labor_cost numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_quote_options jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_status text;
  v_service public.service_records%ROWTYPE;
  v_notif_title text;
  v_notif_msg text;
  v_admin_user record;
  v_opt jsonb;
  v_sort integer := 0;
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

  -- Save quote options if provided
  IF p_quote_options IS NOT NULL AND jsonb_array_length(p_quote_options) > 0 THEN
    DELETE FROM public.service_quote_options WHERE service_id = p_service_id;
    v_sort := 0;
    FOR v_opt IN SELECT * FROM jsonb_array_elements(p_quote_options)
    LOOP
      INSERT INTO public.service_quote_options (service_id, option_name, service_price, parts_cost, labor_cost, sort_order)
      VALUES (
        p_service_id,
        v_opt->>'option_name',
        COALESCE((v_opt->>'service_price')::numeric, 0),
        COALESCE((v_opt->>'parts_cost')::numeric, 0),
        COALESCE((v_opt->>'labor_cost')::numeric, 0),
        v_sort
      );
      v_sort := v_sort + 1;
    END LOOP;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.update_service_status(uuid, text, numeric, numeric, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_service_status(uuid, text, numeric, numeric, numeric, text, jsonb) TO authenticated;

-- ============================================================
-- 4. Update respond_to_service_quote to accept selected option
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_to_service_quote(
  p_service_id uuid,
  p_response text,
  p_selected_option_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_service public.service_records%ROWTYPE;
  v_new_status text;
  v_admin_user record;
  v_option public.service_quote_options%ROWTYPE;
BEGIN
  IF p_response NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Geçersiz yanıt: accept veya reject olmalıdır';
  END IF;

  SELECT * INTO v_service FROM public.service_records WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servis kaydi bulunamadi';
  END IF;

  IF v_service.user_id IS NULL OR v_service.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Bu servis kaydına yetkiniz yok';
  END IF;

  IF v_service.status != 'QUOTED' THEN
    RAISE EXCEPTION 'Bu servis kaydı için teklif yanıtı verilemez';
  END IF;

  v_new_status := CASE WHEN p_response = 'accept' THEN 'APPROVED' ELSE 'REJECTED' END;

  -- If accepting with a selected option, update the service record with that option's pricing
  IF p_response = 'accept' AND p_selected_option_id IS NOT NULL THEN
    SELECT * INTO v_option FROM public.service_quote_options WHERE id = p_selected_option_id AND service_id = p_service_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Geçersiz teklif seçeneği';
    END IF;

    UPDATE public.service_records SET
      status = v_new_status,
      approved_at = now(),
      updated_at = now(),
      service_price = v_option.service_price,
      parts_cost = v_option.parts_cost,
      labor_cost = v_option.labor_cost,
      selected_quote_option_id = p_selected_option_id
    WHERE id = p_service_id;
  ELSE
    UPDATE public.service_records SET
      status = v_new_status,
      approved_at = CASE WHEN p_response = 'accept' THEN now() ELSE approved_at END,
      updated_at = now()
    WHERE id = p_service_id;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.respond_to_service_quote(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_service_quote(uuid, text, uuid) TO authenticated;
