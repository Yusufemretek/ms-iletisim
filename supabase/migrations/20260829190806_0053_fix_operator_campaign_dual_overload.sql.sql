/*
# Fix operator campaign upsert - create both json and jsonb overloads

PostgREST may not have reloaded its schema cache after the json->jsonb change.
Create both overloads so PostgREST can find the function regardless of cache state.
The json version casts to jsonb internally and delegates to the jsonb version.
*/

-- Keep the jsonb version (already exists, recreate to be safe)
CREATE OR REPLACE FUNCTION public.upsert_operator_campaign(p_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_operator_id uuid := (p_data->>'operator_id')::uuid;
  v_category_id uuid := NULL;
  v_name text := p_data->>'name';
  v_slug text := p_data->>'slug';
  v_result json;
  v_base_slug text;
  v_counter int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  IF v_operator_id IS NULL OR v_name IS NULL OR v_slug IS NULL THEN
    RAISE EXCEPTION 'operator_id, name ve slug zorunludur';
  END IF;

  IF p_data->>'category_id' IS NOT NULL AND (p_data->>'category_id')::text <> '' THEN
    v_category_id := (p_data->>'category_id')::uuid;
  END IF;

  v_id := CASE WHEN p_data->>'id' IS NOT NULL AND (p_data->>'id')::text <> '' AND (p_data->>'id')::text <> 'null'
               THEN (p_data->>'id')::uuid ELSE NULL END;

  IF v_id IS NULL THEN
    v_base_slug := v_slug;
    WHILE EXISTS (SELECT 1 FROM public.operator_campaigns WHERE slug = v_slug) LOOP
      v_counter := v_counter + 1;
      v_slug := v_base_slug || '-' || v_counter;
    END LOOP;

    INSERT INTO public.operator_campaigns (
      operator_id, category_id, name, slug,
      short_description, description, image_url,
      monthly_price, price_on_request,
      internet_gb, internet_unlimited,
      minutes, minutes_unlimited,
      sms, sms_unlimited,
      commitment_months, eligibility, age_requirement,
      start_date, end_date, terms, featured, active, archived
    ) VALUES (
      v_operator_id, v_category_id, v_name, v_slug,
      NULLIF(p_data->>'short_description', ''),
      NULLIF(p_data->>'description', ''),
      NULLIF(p_data->>'image_url', ''),
      CASE WHEN p_data->>'monthly_price' IS NOT NULL AND (p_data->>'monthly_price')::text <> 'null' AND (p_data->>'monthly_price')::text <> ''
           THEN (p_data->>'monthly_price')::numeric ELSE NULL END,
      COALESCE((p_data->>'price_on_request')::boolean, false),
      CASE WHEN p_data->>'internet_gb' IS NOT NULL AND (p_data->>'internet_gb')::text <> 'null' AND (p_data->>'internet_gb')::text <> ''
           THEN (p_data->>'internet_gb')::int ELSE NULL END,
      COALESCE((p_data->>'internet_unlimited')::boolean, false),
      CASE WHEN p_data->>'minutes' IS NOT NULL AND (p_data->>'minutes')::text <> 'null' AND (p_data->>'minutes')::text <> ''
           THEN (p_data->>'minutes')::int ELSE NULL END,
      COALESCE((p_data->>'minutes_unlimited')::boolean, false),
      CASE WHEN p_data->>'sms' IS NOT NULL AND (p_data->>'sms')::text <> 'null' AND (p_data->>'sms')::text <> ''
           THEN (p_data->>'sms')::int ELSE NULL END,
      COALESCE((p_data->>'sms_unlimited')::boolean, false),
      CASE WHEN p_data->>'commitment_months' IS NOT NULL AND (p_data->>'commitment_months')::text <> 'null' AND (p_data->>'commitment_months')::text <> ''
           THEN (p_data->>'commitment_months')::int ELSE NULL END,
      COALESCE(
        CASE WHEN p_data->'eligibility' IS NOT NULL AND jsonb_typeof(p_data->'eligibility') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'eligibility'))
             ELSE ARRAY[]::text[] END,
        ARRAY[]::text[]),
      CASE WHEN p_data->>'age_requirement' IS NOT NULL AND (p_data->>'age_requirement')::text <> 'null' AND (p_data->>'age_requirement')::text <> ''
           THEN (p_data->>'age_requirement')::int ELSE NULL END,
      COALESCE(NULLIF(p_data->>'start_date', '')::date, CURRENT_DATE),
      NULLIF(p_data->>'end_date', '')::date,
      NULLIF(p_data->>'terms', ''),
      COALESCE((p_data->>'featured')::boolean, false),
      COALESCE((p_data->>'active')::boolean, true),
      false
    ) RETURNING id INTO v_id;
    v_result := json_build_object('id', v_id, 'created', true, 'slug', v_slug);
  ELSE
    UPDATE public.operator_campaigns SET
      operator_id = v_operator_id,
      category_id = v_category_id,
      name = v_name,
      slug = v_slug,
      short_description = NULLIF(p_data->>'short_description', ''),
      description = NULLIF(p_data->>'description', ''),
      image_url = NULLIF(p_data->>'image_url', ''),
      monthly_price = CASE WHEN p_data->>'monthly_price' IS NOT NULL AND (p_data->>'monthly_price')::text <> 'null' AND (p_data->>'monthly_price')::text <> ''
                           THEN (p_data->>'monthly_price')::numeric ELSE NULL END,
      price_on_request = COALESCE((p_data->>'price_on_request')::boolean, false),
      internet_gb = CASE WHEN p_data->>'internet_gb' IS NOT NULL AND (p_data->>'internet_gb')::text <> 'null' AND (p_data->>'internet_gb')::text <> ''
                         THEN (p_data->>'internet_gb')::int ELSE NULL END,
      internet_unlimited = COALESCE((p_data->>'internet_unlimited')::boolean, false),
      minutes = CASE WHEN p_data->>'minutes' IS NOT NULL AND (p_data->>'minutes')::text <> 'null' AND (p_data->>'minutes')::text <> ''
                    THEN (p_data->>'minutes')::int ELSE NULL END,
      minutes_unlimited = COALESCE((p_data->>'minutes_unlimited')::boolean, false),
      sms = CASE WHEN p_data->>'sms' IS NOT NULL AND (p_data->>'sms')::text <> 'null' AND (p_data->>'sms')::text <> ''
                 THEN (p_data->>'sms')::int ELSE NULL END,
      sms_unlimited = COALESCE((p_data->>'sms_unlimited')::boolean, false),
      commitment_months = CASE WHEN p_data->>'commitment_months' IS NOT NULL AND (p_data->>'commitment_months')::text <> 'null' AND (p_data->>'commitment_months')::text <> ''
                               THEN (p_data->>'commitment_months')::int ELSE NULL END,
      eligibility = COALESCE(
        CASE WHEN p_data->'eligibility' IS NOT NULL AND jsonb_typeof(p_data->'eligibility') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'eligibility'))
             ELSE ARRAY[]::text[] END,
        ARRAY[]::text[]),
      age_requirement = CASE WHEN p_data->>'age_requirement' IS NOT NULL AND (p_data->>'age_requirement')::text <> 'null' AND (p_data->>'age_requirement')::text <> ''
                             THEN (p_data->>'age_requirement')::int ELSE NULL END,
      start_date = COALESCE(NULLIF(p_data->>'start_date', '')::date, CURRENT_DATE),
      end_date = NULLIF(p_data->>'end_date', '')::date,
      terms = NULLIF(p_data->>'terms', ''),
      featured = COALESCE((p_data->>'featured')::boolean, false),
      active = COALESCE((p_data->>'active')::boolean, true),
      updated_at = now()
    WHERE id = v_id;
    v_result := json_build_object('id', v_id, 'updated', true);
  END IF;

  RETURN v_result;
END;
$$;

-- Also create a json overload that simply casts to jsonb and delegates
CREATE OR REPLACE FUNCTION public.upsert_operator_campaign(p_data json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.upsert_operator_campaign(p_data::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_operator_campaign(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_operator_campaign(jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_operator_campaign(json) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_operator_campaign(json) TO authenticated;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
