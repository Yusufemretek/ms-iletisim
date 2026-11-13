/*
# Fix campaigns & operator_campaigns SELECT policies

Admin should see ALL campaigns (active and inactive) to manage them.
Non-admin users should only see active campaigns.

Also fix operator_campaigns: admin needs to see archived/inactive campaigns
in the admin panel, while customers only see active+non-archived.
*/

-- campaigns: replace SELECT policy
DROP POLICY IF EXISTS campaigns_select_any ON public.campaigns;
CREATE POLICY campaigns_select_any
  ON public.campaigns FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

-- operator_campaigns: replace SELECT policy
DROP POLICY IF EXISTS campaigns_public_read ON public.operator_campaigns;
CREATE POLICY campaigns_public_read
  ON public.operator_campaigns FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin()
    OR (active = true AND archived = false AND (end_date IS NULL OR end_date >= CURRENT_DATE))
  );
