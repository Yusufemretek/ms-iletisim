/*
# 2. El Telefon ve Aksesuar Siparis Uygulamasi - Ilk Veritabani Semasi

Bu migration uygulamanin tum temel tablolarini, iliskilerini, guvenlik
politikalarini (RLS) ve sunucu fonksiyonlarini olusturur.

## Yeni Tablolar
1. `admins` - Admin yetkisine sahip kullanicilar (user_id -> auth.users)
2. `profiles` - Kullanici profilleri (ad, soyad, telefon)
3. `addresses` - Musteri teslimat adresleri
4. `categories` - Urun kategorileri
5. `products` - Urunler (telefon + aksesuar, tip alanı ile ayrilir)
6. `product_images` - Urun fotograflari (coklu, ana foto secilebilir)
7. `orders` - Siparisler (siparis no, durum, odeme)
8. `order_items` - Siparis kalemleri (urun anligi korunur)
9. `sales` - Satis kayitlari (Teslim Edildi'de olusur, kâr hesaplar)
10. `notifications` - Uygulama ici bildirimler

## Guvenlik (RLS)
- Musteri yalnizca KENDI profil/adres/siparis/bildirimlerini gorur.
- Admin (admins tablosundaki kullanici) tum verileri gorebilir/duzenleyebilir.
- Kategoriler ve aktif urunler herkes tarafindan okunabilir (vitrin).
- Admin olmayan admin paneline erisemez (is_admin() kontrolu).
- is_admin() SECURITY DEFINER fonksiyon ile admins tablosunu okur;
  kullanici kendi kendini admin yapamaz. Ilk admin bootstrap_first_admin()
  ile (admins tablosu bosken) olusturulur.

## Sunucu Fonksiyonlari
- is_admin() - mevcut kullanici admin mi
- bootstrap_first_admin() - ilk admini olusturur (yalnizca tablo bosken)
- add_admin(target) - mevcut admin baska kullaniciyi admin yapar
- create_order(...) - atomik siparis olusturma (stok kontrolu + dusus)
- set_order_status(...) - admin siparis durumunu gunceller, teslimde satis olusturur

## Storage
- product-images adinda public bucket (urun fotograflari icin)

## Onemli Notlar
1. Urun silindiginde gecmis siparisler bozulmasin diye order_items urun
   bilgilerini (ad, marka, model, fiyat) kendi icinde saklar ve product_id
   ON DELETE SET NULL ile baglanir.
2. Siparis numaralari MS-10001 formatinda, sequence ile otomatik uretilir.
3. Stok, siparis olusturulurken atomik olarak dusurulur (create_order RPC).
*/

-- ============================================================
-- ADMIN YONETIMI
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_self" ON admins;
CREATE POLICY "admins_select_self" ON admins FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- is_admin: mevcut kullanici admin mi? (SECURITY DEFINER, RLS'i asar)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

-- bootstrap_first_admin: admins tablosu bosken cagiran kisiyi admin yapar
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins) THEN
    INSERT INTO public.admins (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- add_admin: mevcut admin baska kullanicinin id'sini admin yapar
CREATE OR REPLACE FUNCTION public.add_admin(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    INSERT INTO public.admins (user_id) VALUES (target) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============================================================
-- ADDRESSES
-- ============================================================

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  city text NOT NULL,
  district text NOT NULL,
  neighborhood text NOT NULL,
  street text NOT NULL,
  building_no text,
  apartment_no text,
  directions text,
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addresses_select_own_or_admin" ON addresses;
CREATE POLICY "addresses_select_own_or_admin" ON addresses FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "addresses_insert_own" ON addresses;
CREATE POLICY "addresses_insert_own" ON addresses FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "addresses_update_own" ON addresses;
CREATE POLICY "addresses_update_own" ON addresses FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "addresses_delete_own" ON addresses;
CREATE POLICY "addresses_delete_own" ON addresses FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_any" ON categories;
CREATE POLICY "categories_select_any" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON categories;
CREATE POLICY "categories_insert_admin" ON categories FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_update_admin" ON categories;
CREATE POLICY "categories_update_admin" ON categories FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin" ON categories FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'accessory' CHECK (type IN ('phone','accessory')),
  name text NOT NULL,
  brand text,
  model text,
  description text,
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  -- Telefon ozel alanlar
  memory text,
  ram text,
  color text,
  imei text,
  battery_health text,
  cosmetic_condition text,
  screen_condition text,
  face_id text,
  touch_id text,
  true_tone text,
  camera_condition text,
  speaker_condition text,
  microphone_condition text,
  warranty_status text,
  warranty_end_date date,
  box_condition text,
  charger_condition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_any" ON products;
CREATE POLICY "products_select_any" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "products_insert_admin" ON products;
CREATE POLICY "products_insert_admin" ON products FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_update_admin" ON products;
CREATE POLICY "products_update_admin" ON products FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_delete_admin" ON products;
CREATE POLICY "products_delete_admin" ON products FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_images_select_any" ON product_images;
CREATE POLICY "product_images_select_any" ON product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "product_images_insert_admin" ON product_images;
CREATE POLICY "product_images_insert_admin" ON product_images FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_images_update_admin" ON product_images;
CREATE POLICY "product_images_update_admin" ON product_images FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_images_delete_admin" ON product_images;
CREATE POLICY "product_images_delete_admin" ON product_images FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- ORDERS
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 10001;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','preparing','shipping','delivered','cancelled')),
  payment_method text NOT NULL DEFAULT 'cash_on_delivery' CHECK (payment_method IN ('cash_on_delivery','card_on_delivery')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  note text,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON orders;
CREATE POLICY "orders_select_own_or_admin" ON orders FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- ORDER ITEMS (urun anligi korunur)
-- ============================================================

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  brand text,
  model text,
  unit_price numeric(12,2) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal numeric(12,2) NOT NULL,
  product_snapshot jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own_or_admin" ON order_items;
CREATE POLICY "order_items_select_own_or_admin" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin()))
  );

-- ============================================================
-- SALES (Teslim Edildi'de olusur)
-- ============================================================

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL,
  total_sale numeric(12,2) NOT NULL,
  profit numeric(12,2) NOT NULL,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_order_id ON sales(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_admin" ON sales;
CREATE POLICY "sales_select_admin" ON sales FOR SELECT
  TO authenticated USING (public.is_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own_or_admin" ON notifications;
CREATE POLICY "notifications_select_own_or_admin" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "notifications_insert_own_or_admin" ON notifications;
CREATE POLICY "notifications_insert_own_or_admin" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON notifications;
CREATE POLICY "notifications_delete_own_or_admin" ON notifications FOR DELETE
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- TRIGGERS: order_number & updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'MS-' || nextval('public.order_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_number ON orders;
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- create_order: atomik siparis olusturma (stok kontrolu + dusus)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order(
  p_address_id uuid,
  p_payment_method text,
  p_note text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_unit numeric(12,2);
  v_qty integer;
  v_subtotal numeric(12,2);
  v_total numeric(12,2) := 0;
  v_addr public.addresses%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_customer_name text;
  v_customer_phone text;
  v_customer_email text;
BEGIN
  -- Kullanici giris yapmis olmali
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Siparis olusturmak icin giris yapmalisiniz';
  END IF;

  -- Adres kullaniciya ait mi
  SELECT * INTO v_addr FROM public.addresses WHERE id = p_address_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gecersiz adres';
  END IF;

  -- Profil bilgileri
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  v_customer_name := COALESCE(v_profile.first_name,'') || ' ' || COALESCE(v_profile.last_name,'');
  v_customer_phone := v_profile.phone;
  v_customer_email := v_profile.email;

  -- Siparisi olustur (order_number trigger ile set edilir)
  INSERT INTO public.orders (user_id, address_id, customer_name, customer_phone, customer_email, status, payment_method, payment_status, note, total)
  VALUES (auth.uid(), p_address_id, v_customer_name, v_customer_phone, v_customer_email, 'new', p_payment_method, 'pending', p_note, 0)
  RETURNING id INTO v_order_id;

  -- Kalemleri isle
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Gecersiz adet';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Urun bulunamadi';
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Yetersiz stok: %', v_product.name;
    END IF;

    v_unit := v_product.sale_price;
    v_subtotal := v_unit * v_qty;
    v_total := v_total + v_subtotal;

    -- Stok dusur
    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;

    -- Kalem ekle (urun anligi korunur)
    INSERT INTO public.order_items (order_id, product_id, product_name, brand, model, unit_price, quantity, subtotal, product_snapshot)
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.brand,
      v_product.model,
      v_unit,
      v_qty,
      v_subtotal,
      to_jsonb(v_product)
    );
  END LOOP;

  -- Toplam guncelle
  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  -- Musteriye bildirim
  INSERT INTO public.notifications (user_id, title, message, type, order_id)
  VALUES (auth.uid(), 'Siparisiniz Alindi', 'Siparisiniz basariyla olusturuldu.', 'order', v_order_id);

  RETURN v_order_id;
END;
$$;

-- ============================================================
-- set_order_status: admin durum gunceller, teslimde satis olusturur
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_cost numeric(12,2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siparis bulunamadi';
  END IF;

  -- Durum guncelle
  UPDATE public.orders SET status = p_status WHERE id = v_order_id;

  -- Teslim edildi: odeme durumunu 'paid' yap ve satis kayitlari olustur
  IF p_status = 'delivered' THEN
    UPDATE public.orders SET payment_status = 'paid' WHERE id = p_order_id;

    -- Ayni siparis icin tekrar satis olusmasin
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE order_id = p_order_id) THEN
      FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
      LOOP
        v_cost := 0;
        SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
        IF FOUND THEN
          v_cost := v_product.cost_price;
        ELSE
          -- Urun silinmisse snapshot'tan al
          v_cost := COALESCE(((v_item.product_snapshot->>'cost_price')::numeric), 0);
        END IF;

        INSERT INTO public.sales (order_id, order_item_id, user_id, product_name, cost_price, sale_price, quantity, total_sale, profit, payment_method)
        VALUES (
          p_order_id,
          v_item.id,
          v_order.user_id,
          v_item.product_name,
          v_cost,
          v_item.unit_price,
          v_item.quantity,
          v_item.subtotal,
          (v_item.unit_price - v_cost) * v_item.quantity,
          v_order.payment_method
        );
      END LOOP;
    END IF;

    -- Musteriye bildirim
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (v_order.user_id, 'Siparisiniz Teslim Edildi', 'Siparisiniz teslim edildi. Tesekkurler!', 'order', p_order_id);
  END IF;

  -- Iptal: stok geri ekle
  IF p_status = 'cancelled' AND v_order.status <> 'cancelled' THEN
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
    LOOP
      UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
    END LOOP;
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (v_order.user_id, 'Siparisiniz Iptal Edildi', 'Siparisiniz iptal edildi.', 'order', p_order_id);
  END IF;
END;
$$;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage politikalari (public read, admin write)
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_admin_write" ON storage.objects;
CREATE POLICY "product_images_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
CREATE POLICY "product_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;
CREATE POLICY "product_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
