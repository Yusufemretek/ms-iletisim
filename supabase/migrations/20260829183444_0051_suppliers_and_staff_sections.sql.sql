/*
# Tedarikçiler (Suppliers) Tablosu ve Personel Bölüm İzinleri

1. Yeni Tablo: suppliers
   - id (uuid, primary key)
   - name (text, tedarikçi adı, zorunlu)
   - contact_person (text, iletişim kişisi)
   - phone (text, telefon)
   - email (text, e-posta)
   - address (text, adres)
   - notes (text, notlar)
   - is_active (boolean, aktif/pasif)
   - created_at (timestamptz)
   - updated_at (timestamptz)

2. Güvenlik
   - RLS etkinleştirildi
   - Sadece admin kullanıcılar CRUD yapabilir (is_admin() kontrolü)

3. Notlar
   - Personel yönetiminde "products" ve "suppliers" bölümleri eklendi
   - AdminSection tipine 'products' ve 'suppliers' değerleri eklendi
   - get_unread_counts_by_section fonksiyonu bu bölümleri desteklemeye devam eder
*/

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_suppliers" ON public.suppliers;
CREATE POLICY "admin_select_suppliers"
ON public.suppliers FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_suppliers" ON public.suppliers;
CREATE POLICY "admin_insert_suppliers"
ON public.suppliers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_suppliers" ON public.suppliers;
CREATE POLICY "admin_update_suppliers"
ON public.suppliers FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_suppliers" ON public.suppliers;
CREATE POLICY "admin_delete_suppliers"
ON public.suppliers FOR DELETE
TO authenticated
USING (public.is_admin());
