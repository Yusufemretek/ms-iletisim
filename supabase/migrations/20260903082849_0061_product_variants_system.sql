/*
# Product Variants (Memory Options) System

## Purpose
Allow products to have multiple memory variants, each with its own price, stock, and SKU.
Customers select a variant on the product detail page; the selected variant's price/stock
drives the cart, checkout, and order flow.

## New Tables
- `product_variants`: id, product_id (FK), storage, price, stock, sku, is_active, sort_order, timestamps

## Modified Tables
- `order_items`: added nullable `variant_id` (FK → product_variants.id ON DELETE SET NULL)

## Security
- RLS enabled on product_variants. Public SELECT, authenticated INSERT/UPDATE/DELETE.

## Notes
- Products without variants continue to work as before. variant_id is nullable.
- Existing data is NOT modified.
*/

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  sku text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_product_variants" ON public.product_variants;
CREATE POLICY "public_read_product_variants" ON public.product_variants
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_product_variants" ON public.product_variants;
CREATE POLICY "auth_insert_product_variants" ON public.product_variants
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_product_variants" ON public.product_variants;
CREATE POLICY "auth_update_product_variants" ON public.product_variants
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_product_variants" ON public.product_variants;
CREATE POLICY "auth_delete_product_variants" ON public.product_variants
  FOR DELETE TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';