-- Update upsert_product(jsonb) to include pickup_only column
CREATE OR REPLACE FUNCTION public.upsert_product(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_type text;
  v_product_id uuid;
BEGIN
  v_id := (p_data->>'id')::uuid;
  v_type := p_data->>'type';

  IF v_id IS NOT NULL THEN
    UPDATE public.products SET
      category_id = NULLIF(p_data->>'category_id', '')::uuid,
      type = v_type,
      name = COALESCE(p_data->>'name', ''),
      brand = NULLIF(p_data->>'brand', ''),
      model = NULLIF(p_data->>'model', ''),
      description = NULLIF(p_data->>'description', ''),
      cost_price = COALESCE((p_data->>'cost_price')::numeric, 0),
      sale_price = COALESCE((p_data->>'sale_price')::numeric, 0),
      stock = COALESCE((p_data->>'stock')::integer, 0),
      is_active = COALESCE((p_data->>'is_active')::boolean, true),
      pickup_only = COALESCE((p_data->>'pickup_only')::boolean, false),
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
      charger_condition = NULLIF(p_data->>'charger_condition', ''),
      screen_size = NULLIF(p_data->>'screen_size', ''),
      camera_info = NULLIF(p_data->>'camera_info', ''),
      battery_capacity = NULLIF(p_data->>'battery_capacity', ''),
      processor = NULLIF(p_data->>'processor', ''),
      operating_system = NULLIF(p_data->>'operating_system', ''),
      installment_config = CASE
        WHEN p_data ? 'installment_config' AND (p_data->>'installment_config') IS NOT NULL AND (p_data->>'installment_config') != 'null'
        THEN (p_data->'installment_config')::jsonb
        ELSE NULL
      END
    WHERE id = v_id
    RETURNING id INTO v_product_id;
    v_product_id := v_id;
  ELSE
    INSERT INTO public.products (
      category_id, type, name, brand, model, description,
      cost_price, sale_price, stock, is_active, pickup_only,
      memory, ram, color, imei, battery_health, cosmetic_condition,
      screen_condition, face_id, touch_id, true_tone,
      camera_condition, speaker_condition, microphone_condition,
      warranty_status, warranty_end_date, box_condition, charger_condition,
      screen_size, camera_info, battery_capacity, processor, operating_system,
      installment_config
    ) VALUES (
      NULLIF(p_data->>'category_id', '')::uuid,
      v_type,
      COALESCE(p_data->>'name', ''),
      NULLIF(p_data->>'brand', ''),
      NULLIF(p_data->>'model', ''),
      NULLIF(p_data->>'description', ''),
      COALESCE((p_data->>'cost_price')::numeric, 0),
      COALESCE((p_data->>'sale_price')::numeric, 0),
      COALESCE((p_data->>'stock')::integer, 0),
      COALESCE((p_data->>'is_active')::boolean, true),
      COALESCE((p_data->>'pickup_only')::boolean, false),
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
      NULLIF(p_data->>'charger_condition', ''),
      NULLIF(p_data->>'screen_size', ''),
      NULLIF(p_data->>'camera_info', ''),
      NULLIF(p_data->>'battery_capacity', ''),
      NULLIF(p_data->>'processor', ''),
      NULLIF(p_data->>'operating_system', ''),
      CASE
        WHEN p_data ? 'installment_config' AND (p_data->>'installment_config') IS NOT NULL AND (p_data->>'installment_config') != 'null'
        THEN (p_data->'installment_config')::jsonb
        ELSE NULL
      END
    )
    RETURNING id INTO v_product_id;
  END IF;

  RETURN v_product_id;
END;
$$;
