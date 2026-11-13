/*
# Add pickup_only to products and min_order_amount to store_settings

1. New Columns
- `products.pickup_only` (boolean, default false) — when true, the product can only be purchased with "Dükkandan Al" (GEL_AL) delivery, kurye delivery is not available.
- `store_settings.min_order_amount` (numeric, default 0) — minimum cart total required for kurye delivery. 0 means no minimum.

2. Security
- No new tables. Existing RLS policies on products and store_settings remain unchanged; the new columns inherit existing column-level grants.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS pickup_only boolean NOT NULL DEFAULT false;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS min_order_amount numeric NOT NULL DEFAULT 0;
