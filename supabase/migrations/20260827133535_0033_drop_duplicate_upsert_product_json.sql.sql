-- Remove the duplicate upsert_product(json) overload.
-- Keep only upsert_product(jsonb) which is the canonical version.
-- This resolves the "Could not choose the best candidate function" error.

DROP FUNCTION IF EXISTS public.upsert_product(p_data json);
