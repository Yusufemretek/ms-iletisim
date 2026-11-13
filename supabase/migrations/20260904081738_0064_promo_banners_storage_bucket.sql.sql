/*
# Create promo-banners storage bucket

1. New Storage Bucket
- `promo-banners` — public bucket for promotional banner background images.

2. Storage Policies
- Public read access for all (anon + authenticated).
- Authenticated users can upload and delete banner images.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('promo-banners', 'promo-banners', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_promo_banners_bucket" ON storage.objects;
CREATE POLICY "anon_read_promo_banners_bucket" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'promo-banners');

DROP POLICY IF EXISTS "auth_insert_promo_banners_bucket" ON storage.objects;
CREATE POLICY "auth_insert_promo_banners_bucket" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'promo-banners');

DROP POLICY IF EXISTS "auth_delete_promo_banners_bucket" ON storage.objects;
CREATE POLICY "auth_delete_promo_banners_bucket" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'promo-banners');
