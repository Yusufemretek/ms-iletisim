/*
# Add operator_lead section to unread counts
*/

CREATE OR REPLACE FUNCTION public.get_unread_counts_by_section()
RETURNS TABLE(section text, unread_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_sections text[];
  v_is_super boolean;
BEGIN
  SELECT public.is_super_admin() INTO v_is_super;
  IF v_is_super THEN
    RETURN QUERY
    SELECT 'orders'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'order' AND user_id = auth.uid()
    UNION ALL
    SELECT 'support'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'support' AND user_id = auth.uid()
    UNION ALL
    SELECT 'service'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'service' AND user_id = auth.uid()
    UNION ALL
    SELECT 'trade_ins'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'trade_in' AND user_id = auth.uid()
    UNION ALL
    SELECT 'sell_phone'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'sell_phone' AND user_id = auth.uid()
    UNION ALL
    SELECT 'operator_lead'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'operator_lead' AND user_id = auth.uid();
  ELSE
    SELECT assigned_sections INTO v_sections FROM public.admins WHERE user_id = auth.uid();
    IF v_sections IS NULL THEN
      v_sections := ARRAY[]::text[];
    END IF;

    IF array_position(v_sections, 'orders') IS NOT NULL THEN
      RETURN QUERY SELECT 'orders'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'order' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'support') IS NOT NULL THEN
      RETURN QUERY SELECT 'support'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'support' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'service') IS NOT NULL THEN
      RETURN QUERY SELECT 'service'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'service' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'trade_ins') IS NOT NULL THEN
      RETURN QUERY SELECT 'trade_ins'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'trade_in' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'sell_phone') IS NOT NULL THEN
      RETURN QUERY SELECT 'sell_phone'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'sell_phone' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'operator_lead') IS NOT NULL THEN
      RETURN QUERY SELECT 'operator_lead'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'operator_lead' AND user_id = auth.uid();
    END IF;
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_unread_counts_by_section() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_counts_by_section() TO authenticated;
