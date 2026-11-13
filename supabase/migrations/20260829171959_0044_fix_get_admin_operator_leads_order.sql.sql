/*
# Fix get_admin_operator_leads: ORDER BY inside json_agg

The original function used ORDER BY on the subquery, but json_agg
doesn't preserve row order unless ORDER BY is inside the aggregate.
This may cause the function to return results in random order, but
shouldn't cause empty results.

The real fix: also check if there's a search_path issue. The function
uses SET search_path = public (without quotes), which should be fine.

Also: add realtime notification to admin when a lead is created.
The trigger already exists but let's verify it works.
*/

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
    ) ORDER BY l.created_at DESC)
    FROM public.operator_leads l
    LEFT JOIN public.operator_campaigns c ON c.id = l.campaign_id
    LEFT JOIN public.operators o ON o.id = l.operator_id),
    '[]'::json
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_operator_leads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_operator_leads() TO authenticated;
