/*
# Add slug column to products table for SEO-friendly URLs

1. Changes
- Add `slug` column (text, unique) to `products` table.
- Populate slugs from product names using a Turkish-aware slugify function.
- Add an index on slug for fast lookups.
- Add a trigger to auto-generate slug on insert/update if not provided.

2. Security
- No RLS policy changes — existing policies remain intact.
- The slug column is readable by anyone who can already SELECT products.

3. Notes
- The slugify function replaces Turkish characters (ç, ğ, ı, ö, ş, ü) with ASCII equivalents.
- Spaces become hyphens, all lowercase, non-alphanumeric characters removed.
- If a slug would collide, a numeric suffix is appended.
*/

-- Turkish-aware slugify function
CREATE OR REPLACE FUNCTION slugify(input_text text)
RETURNS text AS $$
DECLARE
  result text;
  base_slug text;
  counter integer := 0;
  existing_count integer;
BEGIN
  -- Replace Turkish characters
  result := lower(input_text);
  result := replace(result, 'ç', 'c');
  result := replace(result, 'ğ', 'g');
  result := replace(result, 'ı', 'i');
  result := replace(result, 'İ', 'i');
  result := replace(result, 'ö', 'o');
  result := replace(result, 'ş', 's');
  result := replace(result, 'ü', 'u');
  result := replace(result, 'Ç', 'c');
  result := replace(result, 'Ğ', 'g');
  result := replace(result, 'Ö', 'o');
  result := replace(result, 'Ş', 's');
  result := replace(result, 'Ü', 'u');
  -- Replace spaces with hyphens
  result := regexp_replace(result, '\s+', '-', 'g');
  -- Remove non-alphanumeric (keep hyphens)
  result := regexp_replace(result, '[^a-z0-9\-]', '', 'g');
  -- Collapse multiple hyphens
  result := regexp_replace(result, '-+', '-', 'g');
  -- Trim leading/trailing hyphens
  result := trim(both '-' from result);

  base_slug := result;

  -- Handle collisions
  LOOP
    IF counter = 0 THEN
      SELECT count(*) INTO existing_count FROM products WHERE slug = result AND name <> input_text;
      IF existing_count = 0 THEN
        EXIT;
      END IF;
    END IF;
    counter := counter + 1;
    result := base_slug || '-' || counter::text;
    SELECT count(*) INTO existing_count FROM products WHERE slug = result AND name <> input_text;
    EXIT WHEN existing_count = 0;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add slug column
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;

-- Populate slugs for existing products
UPDATE products
SET slug = slugify(name)
WHERE slug IS NULL OR slug = '';

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique_idx ON products (slug) WHERE slug IS NOT NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS products_slug_idx ON products (slug);

-- Auto-generate slug on insert if not provided
CREATE OR REPLACE FUNCTION products_set_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := slugify(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_set_slug_trigger ON products;
CREATE TRIGGER products_set_slug_trigger
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_set_slug();

-- Also auto-generate slug on update if name changes and slug not manually set
CREATE OR REPLACE FUNCTION products_update_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.name <> OLD.name AND (NEW.slug IS NULL OR NEW.slug = OLD.slug) THEN
    NEW.slug := slugify(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_update_slug_trigger ON products;
CREATE TRIGGER products_update_slug_trigger
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_update_slug();
