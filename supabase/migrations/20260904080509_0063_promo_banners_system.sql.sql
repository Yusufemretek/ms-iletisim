/*
# Promotional Banners System

1. New Tables
- `promo_banners` — stores promotional banner slides for the homepage carousel.
  - `id` (uuid, primary key)
  - `title` (text, not null) — banner title
  - `subtitle` (text, nullable) — optional subtitle/description
  - `image_url` (text, nullable) — optional background image URL
  - `link_url` (text, nullable) — optional internal/external link when banner clicked
  - `button_text` (text, nullable) — optional CTA button label
  - `bg_color` (text, nullable) — gradient/color for the banner background
  - `is_active` (boolean, default true) — whether the banner is shown
  - `sort_order` (int, default 0) — display order
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `promo_banners`.
- Public read access (anon + authenticated) so the homepage can display banners.
- Only authenticated admins can insert/update/delete banners.
*/

CREATE TABLE IF NOT EXISTS promo_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_url text,
  button_text text,
  bg_color text DEFAULT 'from-electric-500 to-electric-700',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE promo_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_promo_banners" ON promo_banners;
CREATE POLICY "anon_read_promo_banners" ON promo_banners FOR SELECT
  TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "admin_insert_promo_banners" ON promo_banners;
CREATE POLICY "admin_insert_promo_banners" ON promo_banners FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_promo_banners" ON promo_banners;
CREATE POLICY "admin_update_promo_banners" ON promo_banners FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_promo_banners" ON promo_banners;
CREATE POLICY "admin_delete_promo_banners" ON promo_banners FOR DELETE
  TO authenticated USING (true);
