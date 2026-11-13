/*
# Fix promo_banners SELECT policy for admin access

## Problem
The SELECT policy `anon_read_promo_banners` was scoped to `TO anon, authenticated` with `USING (is_active = true)`.
This meant authenticated admins could only see active banners — when they deactivated a banner, it disappeared
from the admin list because the SELECT policy filtered it out.

## Fix
- Split the SELECT policy into two:
  - `anon_read_active_promo_banners` — TO anon only, USING (is_active = true) — public homepage sees only active banners
  - `admin_read_all_promo_banners` — TO authenticated, USING (true) — admins see all banners regardless of status
*/

DROP POLICY IF EXISTS "anon_read_promo_banners" ON promo_banners;

DROP POLICY IF EXISTS "anon_read_active_promo_banners" ON promo_banners;
CREATE POLICY "anon_read_active_promo_banners" ON promo_banners FOR SELECT
  TO anon USING (is_active = true);

DROP POLICY IF EXISTS "admin_read_all_promo_banners" ON promo_banners;
CREATE POLICY "admin_read_all_promo_banners" ON promo_banners FOR SELECT
  TO authenticated USING (true);
