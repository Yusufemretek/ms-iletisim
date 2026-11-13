/*
# Fix trade_ins trigger + add photos column

1. Schema Changes
- Add `photos jsonb` column to `trade_ins` table (array of photo URLs).

2. Bug Fix
- The trigger function `trg_fn_notify_trade_in` references `NEW.brand` and
  `NEW.model`, but the actual columns are `old_device_brand` and
  `old_device_model`. This causes the INSERT to fail with a column-not-found
  error. Fix the trigger to use the correct column names.

3. Security
- No policy changes needed; existing RLS policies already cover the new column.
*/

ALTER TABLE public.trade_ins
  ADD COLUMN IF NOT EXISTS photos jsonb;

CREATE OR REPLACE FUNCTION public.trg_fn_notify_trade_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.notify_admins(
    'Yeni Takas Talebi',
    NEW.customer_name || ' takas talebi olusturdu: ' || COALESCE(NEW.old_device_brand, '') || ' ' || COALESCE(NEW.old_device_model, ''),
    'trade_in'
  );
  RETURN NEW;
END;
$$;
