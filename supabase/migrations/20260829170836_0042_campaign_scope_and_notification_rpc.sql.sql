/*
# Campaign notification RPC + campaign scope columns

## 1. New RPC: notify_campaign_created
- Sends a notification to ALL authenticated users (customers) when a campaign is created.
- Called from the admin UI after inserting a campaign.

## 2. Add scope_type column to campaigns
- `scope_type` text: 'all' | 'products' | 'categories' — what the discount applies to
- Uses existing `product_ids` (uuid[]) and `category_ids` (uuid[]) columns for target selection.
*/

-- Add scope_type column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'scope_type') THEN
    ALTER TABLE public.campaigns ADD COLUMN scope_type text NOT NULL DEFAULT 'all';
  END IF;
END $$;

-- RPC to notify all customers about a new campaign
CREATE OR REPLACE FUNCTION public.notify_campaign_created(
  p_campaign_name text,
  p_campaign_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_msg text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  v_msg := COALESCE(p_campaign_description, 'Yeni bir kampanyamiz basladi! Hemen inceleyin.');

  FOR v_user IN SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' IS DISTINCT FROM 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_user.id, 'Yeni Kampanya: ' || p_campaign_name, v_msg, 'campaign');
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_campaign_created(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_campaign_created(text, text) TO authenticated;
