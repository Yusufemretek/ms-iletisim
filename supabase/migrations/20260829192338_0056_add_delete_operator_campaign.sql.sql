/*
# Add delete_operator_campaign RPC

1. New Function
- `delete_operator_campaign(p_campaign_id uuid)` — permanently deletes a campaign.
- SECURITY DEFINER, admin-only (is_admin check).
- Prevents deletion if the campaign has leads (operator_leads with FK).
- Returns jsonb with success/error info.

2. Security
- EXECUTE revoked from PUBLIC, granted to authenticated only.
- Reload PostgREST schema cache.
*/

CREATE OR REPLACE FUNCTION public.delete_operator_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Admin gereklidir';
  END IF;

  SELECT COUNT(*) INTO v_lead_count
  FROM public.operator_leads
  WHERE campaign_id = p_campaign_id;

  IF v_lead_count > 0 THEN
    RAISE EXCEPTION 'Bu kampanyaya ait % adet talep bulunduğu için silinemez. Arşivleyebilirsiniz.', v_lead_count;
  END IF;

  DELETE FROM public.operator_campaigns WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kampanya bulunamadı';
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted', p_campaign_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_operator_campaign(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_operator_campaign(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';