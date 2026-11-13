/*
# Revoke execute on operator campaign SECURITY DEFINER functions from anon/authenticated

## Overview
The previous migration revoked EXECUTE from PUBLIC, but Supabase's anon and
authenticated roles may retain explicit grants. This migration explicitly
revokes EXECUTE from anon and authenticated for all operator campaign
SECURITY DEFINER functions, ensuring only admin users (checked via is_admin())
can invoke them through the Supabase client.

## Changes
- REVOKE EXECUTE on 7 functions FROM anon, authenticated
- Functions are still callable by authenticated users who are admins (is_admin() check)
*/

REVOKE EXECUTE ON FUNCTION public.upsert_operator_campaign(json) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.archive_operator_campaign(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_operator_campaigns() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_operator_lead_status(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_operator_leads() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_operator(json) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_campaign_category(json) FROM anon, authenticated;