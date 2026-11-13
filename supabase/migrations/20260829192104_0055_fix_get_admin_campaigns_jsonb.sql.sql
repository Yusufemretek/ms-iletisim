/*
# Fix get_admin_operator_campaigns return type to jsonb

1. Problem
- get_admin_operator_campaigns returns `json` type.
- PostgREST handles `jsonb` more reliably for complex nested objects.
- When the function errors, the frontend silently shows an empty list
  because load() does not check for errors.

2. Database change
- Change return type from `json` to `jsonb`.
- Use `jsonb_agg` and `jsonb_build_object` instead of `json_agg` and `json_build_object`.
- No table data or schema changes.

3. Security
- SECURITY DEFINER preserved.
- EXECUTE revoked from PUBLIC, granted to authenticated only.
- Reload PostgREST schema cache.
*/

DROP FUNCTION IF EXISTS public.get_admin_operator_campaigns();

CREATE OR REPLACE FUNCTION public.get_admin_operator_campaigns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
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
    ) ORDER BY c.created_at DESC)
    FROM public.operator_campaigns c
    LEFT JOIN public.operators o ON o.id = c.operator_id
    LEFT JOIN public.operator_campaign_categories cat ON cat.id = c.category_id),
    '[]'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_operator_campaigns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_operator_campaigns() TO authenticated;

NOTIFY pgrst, 'reload schema';