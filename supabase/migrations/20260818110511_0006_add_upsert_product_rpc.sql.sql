/*
# Ürün ekleme/güncelleme RPC fonksiyonu

Frontend'den direkt products tablosuna insert/update yaparken
RLS politikaları is_admin() kontrolü yapıyor. Eğer herhangi bir
nedenden dolayı is_admin() false dönerse insert reddediliyor.
Bu fonksiyon SECURITY DEFINER olarak RLS'i aşar ve admin
kontrolünü kendi içinde yapar.
*/

CREATE OR REPLACE FUNCTION public.upsert_product(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_product_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz işlem: admin yetkisi gerekli';
  END IF;

  v_id := (p_data->>'id')::uuid;

  IF v_id IS NOT NULL THEN
    -- Update existing product
    UPDATE public.products SET
      category_id = NULLIF(p_data->>'category_id', '')::uuid,
      type = COALESCE(p_data->>'type', 'accessory'),
      name = COALESCE(p_data->>'name', ''),
      brand = NULLIF(p_data->>'brand', ''),
      model = NULLIF(p_data->>'model', ''),
      description = NULLIF(p_data->>'description', ''),
      cost_price = COALESCE((p_data->>'cost_price')::numeric, 0),
      sale_price = COALESCE((p_data->>'sale_price')::numeric, 0),
      stock = COALESCE((p_data->>'stock')::integer, 0),
      is_active = COALESCE((p_data->>'is_active')::boolean, true),
      memory = NULLIF(p_data->>'memory', ''),
      ram = NULLIF(p_data->>'ram', ''),
      color = NULLIF(p_data->>'color', ''),
      imei = NULLIF(p_data->>'imei', ''),
      battery_health = NULLIF(p_data->>'battery_health', ''),
      cosmetic_condition = NULLIF(p_data->>'cosmetic_condition', ''),
      screen_condition = NULLIF(p_data->>'screen_condition', ''),
      face_id = NULLIF(p_data->>'face_id', ''),
      touch_id = NULLIF(p_data->>'touch_id', ''),
      true_tone = NULLIF(p_data->>'true_tone', ''),
      camera_condition = NULLIF(p_data->>'camera_condition', ''),
      speaker_condition = NULLIF(p_data->>'speaker_condition', ''),
      microphone_condition = NULLIF(p_data->>'microphone_condition', ''),
      warranty_status = NULLIF(p_data->>'warranty_status', ''),
      warranty_end_date = NULLIF(p_data->>'warranty_end_date', '')::date,
      box_condition = NULLIF(p_data->>'box_condition', ''),
      charger_condition = NULLIF(p_data->>'charger_condition', '')
    WHERE id = v_id
    RETURNING id INTO v_product_id;

    v_product_id := v_id;
  ELSE
    -- Insert new product
    INSERT INTO public.products (
      category_id, type, name, brand, model, description,
      cost_price, sale_price, stock, is_active,
      memory, ram, color, imei, battery_health, cosmetic_condition,
      screen_condition, face_id, touch_id, true_tone,
      camera_condition, speaker_condition, microphone_condition,
      warranty_status, warranty_end_date, box_condition, charger_condition
    ) VALUES (
      NULLIF(p_data->>'category_id', '')::uuid,
      COALESCE(p_data->>'type', 'accessory'),
      COALESCE(p_data->>'name', ''),
      NULLIF(p_data->>'brand', ''),
      NULLIF(p_data->>'model', ''),
      NULLIF(p_data->>'description', ''),
      COALESCE((p_data->>'cost_price')::numeric, 0),
      COALESCE((p_data->>'sale_price')::numeric, 0),
      COALESCE((p_data->>'stock')::integer, 0),
      COALESCE((p_data->>'is_active')::boolean, true),
      NULLIF(p_data->>'memory', ''),
      NULLIF(p_data->>'ram', ''),
      NULLIF(p_data->>'color', ''),
      NULLIF(p_data->>'imei', ''),
      NULLIF(p_data->>'battery_health', ''),
      NULLIF(p_data->>'cosmetic_condition', ''),
      NULLIF(p_data->>'screen_condition', ''),
      NULLIF(p_data->>'face_id', ''),
      NULLIF(p_data->>'touch_id', ''),
      NULLIF(p_data->>'true_tone', ''),
      NULLIF(p_data->>'camera_condition', ''),
      NULLIF(p_data->>'speaker_condition', ''),
      NULLIF(p_data->>'microphone_condition', ''),
      NULLIF(p_data->>'warranty_status', ''),
      NULLIF(p_data->>'warranty_end_date', '')::date,
      NULLIF(p_data->>'box_condition', ''),
      NULLIF(p_data->>'charger_condition', '')
    )
    RETURNING id INTO v_product_id;
  END IF;

  RETURN v_product_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_product(p_data jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_product(p_data jsonb) TO authenticated;
