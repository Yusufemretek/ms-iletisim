/*
# Operator Campaign RPC Functions

## Overview
SECURITY DEFINER RPC functions for admin management of operators, campaign
categories, campaigns, and leads. All functions verify admin status via
is_admin() before performing mutations.

## Functions

### Admin Campaign Management
1. **upsert_operator_campaign(p_data json)** — Create or update a campaign.
   Admin-only. Validates operator_id exists. Sets archived=false on create.
2. **archive_operator_campaign(p_campaign_id uuid)** — Soft-delete (archive)
   a campaign. Admin-only. Preserves lead relationships.
3. **get_admin_operator_campaigns()** — Returns ALL campaigns (including
   archived/inactive/expired) for admin list view. Admin-only.

### Admin Lead Management
4. **update_operator_lead_status(p_lead_id uuid, p_status text, p_admin_note text)**
   — Updates lead status and/or admin note. Admin-only.
5. **get_admin_operator_leads()** — Returns all leads with campaign + operator
   info. Admin-only.

### Admin Operator/Category Management
6. **upsert_operator(p_data json)** — Create/update an operator. Admin-only.
7. **upsert_campaign_category(p_data json)** — Create/update a category. Admin-only.

## Security
- All functions use SECURITY DEFINER with search_path = public.
- All mutation functions call is_admin() and RAISE EXCEPTION if not admin.
- Public read is handled by RLS policies on the tables directly.

## Important Notes
1. Campaign slug uniqueness is enforced per-operator (operator_id + slug).
2. Lead deduplication: one lead per campaign per user within 24 hours.
3. Archive never physically deletes — leads retain their campaign reference.
*/

-- =========================================================
-- 1. upsert_operator_campaign
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_operator_campaign(p_data json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_data->>'id')::uuid;
  v_operator_id uuid := (p_data->>'operator_id')::uuid;
  v_category_id uuid := NULL;
  v_name text := p_data->>'name';
  v_slug text := p_data->>'slug';
  v_result json;
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

  IF v_id IS NULL THEN
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
      NULLIF(p_data->>'monthly_price', '')::numeric,
      COALESCE((p_data->>'price_on_request')::boolean, false),
      NULLIF(p_data->>'internet_gb', '')::int,
      COALESCE((p_data->>'internet_unlimited')::boolean, false),
      NULLIF(p_data->>'minutes', '')::int,
      COALESCE((p_data->>'minutes_unlimited')::boolean, false),
      NULLIF(p_data->>'sms', '')::int,
      COALESCE((p_data->>'sms_unlimited')::boolean, false),
      NULLIF(p_data->>'commitment_months', '')::int,
      COALESCE(ARRAY(SELECT json_array_elements_text(p_data->'eligibility')), ARRAY[]::text[]),
      NULLIF(p_data->>'age_requirement', '')::int,
      COALESCE(NULLIF(p_data->>'start_date', '')::date, CURRENT_DATE),
      NULLIF(p_data->>'end_date', '')::date,
      NULLIF(p_data->>'terms', ''),
      COALESCE((p_data->>'featured')::boolean, false),
      COALESCE((p_data->>'active')::boolean, true),
      false
    ) RETURNING id INTO v_id;
    v_result := json_build_object('id', v_id, 'created', true);
  ELSE
    UPDATE public.operator_campaigns SET
      operator_id = v_operator_id,
      category_id = v_category_id,
      name = v_name,
      slug = v_slug,
      short_description = NULLIF(p_data->>'short_description', ''),
      description = NULLIF(p_data->>'description', ''),
      image_url = NULLIF(p_data->>'image_url', ''),
      monthly_price = NULLIF(p_data->>'monthly_price', '')::numeric,
      price_on_request = COALESCE((p_data->>'price_on_request')::boolean, false),
      internet_gb = NULLIF(p_data->>'internet_gb', '')::int,
      internet_unlimited = COALESCE((p_data->>'internet_unlimited')::boolean, false),
      minutes = NULLIF(p_data->>'minutes', '')::int,
      minutes_unlimited = COALESCE((p_data->>'minutes_unlimited')::boolean, false),
      sms = NULLIF(p_data->>'sms', '')::int,
      sms_unlimited = COALESCE((p_data->>'sms_unlimited')::boolean, false),
      commitment_months = NULLIF(p_data->>'commitment_months', '')::int,
      eligibility = COALESCE(ARRAY(SELECT json_array_elements_text(p_data->'eligibility')), ARRAY[]::text[]),
      age_requirement = NULLIF(p_data->>'age_requirement', '')::int,
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

-- =========================================================
-- 2. archive_operator_campaign
-- =========================================================
CREATE OR REPLACE FUNCTION public.archive_operator_campaign(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  UPDATE public.operator_campaigns
  SET archived = true, active = false, updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;

-- =========================================================
-- 3. get_admin_operator_campaigns
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_admin_operator_campaigns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  RETURN COALESCE(
    (SELECT json_agg(json_build_object(
      'id', c.id,
      'operator_id', c.operator_id,
      'operator_name', o.name,
      'operator_slug', o.slug,
      'operator_color', o.color,
      'category_id', c.category_id,
      'category_name', cat.name,
      'name', c.name,
      'slug', c.slug,
      'short_description', c.short_description,
      'description', c.description,
      'image_url', c.image_url,
      'monthly_price', c.monthly_price,
      'price_on_request', c.price_on_request,
      'internet_gb', c.internet_gb,
      'internet_unlimited', c.internet_unlimited,
      'minutes', c.minutes,
      'minutes_unlimited', c.minutes_unlimited,
      'sms', c.sms,
      'sms_unlimited', c.sms_unlimited,
      'commitment_months', c.commitment_months,
      'eligibility', c.eligibility,
      'age_requirement', c.age_requirement,
      'start_date', c.start_date,
      'end_date', c.end_date,
      'terms', c.terms,
      'featured', c.featured,
      'active', c.active,
      'archived', c.archived,
      'lead_count', (SELECT COUNT(*) FROM public.operator_leads l WHERE l.campaign_id = c.id),
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ))
    FROM public.operator_campaigns c
    LEFT JOIN public.operators o ON o.id = c.operator_id
    LEFT JOIN public.operator_campaign_categories cat ON cat.id = c.category_id
    ORDER BY c.created_at DESC),
    '[]'::json
  );
END;
$$;

-- =========================================================
-- 4. update_operator_lead_status
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_operator_lead_status(
  p_lead_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  UPDATE public.operator_leads
  SET
    status = p_status,
    admin_note = COALESCE(p_admin_note, admin_note),
    updated_at = now()
  WHERE id = p_lead_id;
END;
$$;

-- =========================================================
-- 5. get_admin_operator_leads
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_admin_operator_leads()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  RETURN COALESCE(
    (SELECT json_agg(json_build_object(
      'id', l.id,
      'campaign_id', l.campaign_id,
      'campaign_name', c.name,
      'operator_id', l.operator_id,
      'operator_name', o.name,
      'operator_color', o.color,
      'user_id', l.user_id,
      'full_name', l.full_name,
      'phone', l.phone,
      'email', l.email,
      'current_operator', l.current_operator,
      'request_type', l.request_type,
      'customer_note', l.customer_note,
      'admin_note', l.admin_note,
      'status', l.status,
      'created_at', l.created_at,
      'updated_at', l.updated_at
    ))
    FROM public.operator_leads l
    LEFT JOIN public.operator_campaigns c ON c.id = l.campaign_id
    LEFT JOIN public.operators o ON o.id = l.operator_id
    ORDER BY l.created_at DESC),
    '[]'::json
  );
END;
$$;

-- =========================================================
-- 6. upsert_operator
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_operator(p_data json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_data->>'id')::uuid;
  v_name text := p_data->>'name';
  v_slug text := p_data->>'slug';
  v_result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  IF v_name IS NULL OR v_slug IS NULL THEN
    RAISE EXCEPTION 'name ve slug zorunludur';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.operators (name, slug, logo_url, color, active, sort_order)
    VALUES (
      v_name, v_slug,
      NULLIF(p_data->>'logo_url', ''),
      COALESCE(NULLIF(p_data->>'color', ''), '#6366f1'),
      COALESCE((p_data->>'active')::boolean, true),
      COALESCE(NULLIF(p_data->>'sort_order', '')::int, 0)
    )
    RETURNING id INTO v_id;
    v_result := json_build_object('id', v_id, 'created', true);
  ELSE
    UPDATE public.operators SET
      name = v_name,
      slug = v_slug,
      logo_url = NULLIF(p_data->>'logo_url', ''),
      color = COALESCE(NULLIF(p_data->>'color', ''), color),
      active = COALESCE((p_data->>'active')::boolean, active),
      sort_order = COALESCE(NULLIF(p_data->>'sort_order', '')::int, sort_order),
      updated_at = now()
    WHERE id = v_id;
    v_result := json_build_object('id', v_id, 'updated', true);
  END IF;

  RETURN v_result;
END;
$$;

-- =========================================================
-- 7. upsert_campaign_category
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_campaign_category(p_data json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_data->>'id')::uuid;
  v_name text := p_data->>'name';
  v_slug text := p_data->>'slug';
  v_result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  IF v_name IS NULL OR v_slug IS NULL THEN
    RAISE EXCEPTION 'name ve slug zorunludur';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.operator_campaign_categories (name, slug, sort_order, active)
    VALUES (
      v_name, v_slug,
      COALESCE(NULLIF(p_data->>'sort_order', '')::int, 0),
      COALESCE((p_data->>'active')::boolean, true)
    )
    RETURNING id INTO v_id;
    v_result := json_build_object('id', v_id, 'created', true);
  ELSE
    UPDATE public.operator_campaign_categories SET
      name = v_name,
      slug = v_slug,
      sort_order = COALESCE(NULLIF(p_data->>'sort_order', '')::int, sort_order),
      active = COALESCE((p_data->>'active')::boolean, active)
    WHERE id = v_id;
    v_result := json_build_object('id', v_id, 'updated', true);
  END IF;

  RETURN v_result;
END;
$$;

-- Revoke execute from anon/public (SECURITY DEFINER functions should not be callable by anon)
REVOKE EXECUTE ON FUNCTION public.upsert_operator_campaign(json) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.archive_operator_campaign(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_operator_campaigns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_operator_lead_status(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_operator_leads() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_operator(json) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_campaign_category(json) FROM PUBLIC;