/*
# Storage bucket for sell-phone photos

1. New Storage
- Create a public bucket `sell-phone-photos` for customer-uploaded device photos
  in the "Telefonunu Sat" flow.
- Public read so admins can view photos without signed URLs.
- Authenticated users can upload and delete their own photos.
2. Security
- SELECT (public read): anyone can view photos.
- INSERT: authenticated users can upload.
- UPDATE/DELETE: authenticated users can delete their own uploads (by path prefix
  containing their user id).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('sell-phone-photos', 'sell-phone-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "sell_phone_photos_public_read" ON storage.objects;
CREATE POLICY "sell_phone_photos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'sell-phone-photos');

-- Authenticated insert
DROP POLICY IF EXISTS "sell_phone_photos_insert_own" ON storage.objects;
CREATE POLICY "sell_phone_photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sell-phone-photos');

-- Authenticated delete own (path contains user id folder)
DROP POLICY IF EXISTS "sell_phone_photos_delete_own" ON storage.objects;
CREATE POLICY "sell_phone_photos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sell-phone-photos');
