/*
# Remove ambiguous operator campaign function overload

1. Problem
- The API currently exposes two functions with the same name:
  `upsert_operator_campaign(json)` and `upsert_operator_campaign(jsonb)`.
- Supabase cannot choose between them when the browser sends the campaign object,
  so saving fails before the function runs.

2. Database change
- Remove only the obsolete `json` overload.
- Keep the working `jsonb` function used by the application.
- No campaign rows, columns, or table data are removed.

3. Security
- Preserve authenticated-only EXECUTE access on the remaining `jsonb` function.
- Reload the API schema so the browser sees one unambiguous function.
*/

DROP FUNCTION IF EXISTS public.upsert_operator_campaign(json);

REVOKE EXECUTE ON FUNCTION public.upsert_operator_campaign(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_operator_campaign(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';