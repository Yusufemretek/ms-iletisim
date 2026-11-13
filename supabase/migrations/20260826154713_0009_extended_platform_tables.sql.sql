/*
# MS İletişim - Genişletilmiş Platform Tabloları

## Genel Açıklama
Mevcut finansal sisteme ek olarak, 2. el telefon, telefon sat, takas, canlı destek, favoriler, markalar, kampanyalar, sadakat puanları ve mağaza ayarları için yeni tablolar ekler. Mevcut tablolar korunur.

## Yeni Tablolar
1. **brands** - Marka yönetimi
2. **used_devices** - 2. el telefon envanteri (her cihaz ayrı kayıt)
3. **used_device_images** - 2. el cihaz fotoğrafları
4. **sell_phone_requests** - Müşteri telefon satış talepleri
5. **trade_ins** - Takas işlemleri
6. **chat_conversations** - Canlı destek konuşmaları
7. **chat_messages** - Destek mesajları
8. **favorites** - Müşteri favori ürünleri
9. **stock_alerts** - Stok gelince haber ver talepleri
10. **campaigns** - Kampanya yönetimi
11. **loyalty_points** - Sadakat puanları
12. **store_settings** - Mağaza ayarları (tek satır)
13. **service_photos** - Servis cihaz fotoğrafları
14. **product_reviews** - Müşteri yorumları
*/

-- ============================================================
-- 1. BRANDS (Markalar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  logo text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select_any" ON public.brands;
CREATE POLICY "brands_select_any" ON public.brands FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "brands_insert_admin" ON public.brands;
CREATE POLICY "brands_insert_admin" ON public.brands FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "brands_update_admin" ON public.brands;
CREATE POLICY "brands_update_admin" ON public.brands FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "brands_delete_admin" ON public.brands;
CREATE POLICY "brands_delete_admin" ON public.brands FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 2. USED_DEVICES (2. El Telefon Envanteri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.used_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  storage text,
  color text,
  imei text UNIQUE,
  serial_number text,
  battery_health text,
  cosmetic_grade text,
  screen_condition text,
  body_condition text,
  camera_condition text,
  face_id_status text,
  touch_id_status text,
  original_screen boolean DEFAULT true,
  changed_parts text,
  warranty_status text,
  purchase_price numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.used_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "used_devices_select_any" ON public.used_devices;
CREATE POLICY "used_devices_select_any" ON public.used_devices FOR SELECT
  TO anon, authenticated USING (status = 'available' OR public.is_admin());
DROP POLICY IF EXISTS "used_devices_insert_admin" ON public.used_devices;
CREATE POLICY "used_devices_insert_admin" ON public.used_devices FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "used_devices_update_admin" ON public.used_devices;
CREATE POLICY "used_devices_update_admin" ON public.used_devices FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "used_devices_delete_admin" ON public.used_devices;
CREATE POLICY "used_devices_delete_admin" ON public.used_devices FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 3. USED_DEVICE_IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.used_device_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.used_devices(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.used_device_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "used_device_images_select_any" ON public.used_device_images;
CREATE POLICY "used_device_images_select_any" ON public.used_device_images FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "used_device_images_insert_admin" ON public.used_device_images;
CREATE POLICY "used_device_images_insert_admin" ON public.used_device_images FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "used_device_images_delete_admin" ON public.used_device_images;
CREATE POLICY "used_device_images_delete_admin" ON public.used_device_images FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 4. SELL_PHONE_REQUESTS (Telefonunu Sat)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sell_phone_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL,
  user_id uuid,
  brand text NOT NULL,
  model text NOT NULL,
  storage text,
  color text,
  battery_health text,
  cosmetic_condition text,
  screen_condition text,
  changed_parts text,
  imei text,
  photos jsonb DEFAULT '[]'::jsonb,
  offer_price numeric,
  status text NOT NULL DEFAULT 'PENDING',
  customer_name text,
  customer_phone text,
  customer_email text,
  admin_notes text,
  pickup_preference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sell_phone_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sell_phone_select_own_or_admin" ON public.sell_phone_requests;
CREATE POLICY "sell_phone_select_own_or_admin" ON public.sell_phone_requests FOR SELECT
  TO authenticated USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "sell_phone_insert_own" ON public.sell_phone_requests;
CREATE POLICY "sell_phone_insert_own" ON public.sell_phone_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "sell_phone_update_admin" ON public.sell_phone_requests;
CREATE POLICY "sell_phone_update_admin" ON public.sell_phone_requests FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "sell_phone_update_own" ON public.sell_phone_requests;
CREATE POLICY "sell_phone_update_own" ON public.sell_phone_requests FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Request number trigger
CREATE OR REPLACE FUNCTION public.set_sell_phone_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.sell_phone_requests WHERE created_at::date = now()::date;
  NEW.request_number := 'SELL-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sell_phone_number ON public.sell_phone_requests;
CREATE TRIGGER trg_sell_phone_number
  BEFORE INSERT ON public.sell_phone_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_sell_phone_number();

REVOKE EXECUTE ON FUNCTION public.set_sell_phone_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_sell_phone_number() TO authenticated;

-- ============================================================
-- 5. TRADE_INS (Takas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trade_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_number text NOT NULL,
  user_id uuid,
  new_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  new_product_name text,
  new_product_price numeric NOT NULL DEFAULT 0,
  old_device_brand text NOT NULL,
  old_device_model text NOT NULL,
  old_device_imei text,
  old_device_offer numeric NOT NULL DEFAULT 0,
  old_device_condition text,
  remaining_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  customer_name text,
  customer_phone text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_in_select_own_or_admin" ON public.trade_ins;
CREATE POLICY "trade_in_select_own_or_admin" ON public.trade_ins FOR SELECT
  TO authenticated USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "trade_in_insert_own" ON public.trade_ins;
CREATE POLICY "trade_in_insert_own" ON public.trade_ins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "trade_in_update_admin" ON public.trade_ins;
CREATE POLICY "trade_in_update_admin" ON public.trade_ins FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "trade_in_update_own" ON public.trade_ins;
CREATE POLICY "trade_in_update_own" ON public.trade_ins FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_trade_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  v_count := 0;
  SELECT count(*) + 1 INTO v_count FROM public.trade_ins WHERE created_at::date = now()::date;
  NEW.trade_number := 'TRD-' || to_char(now(), 'YYMMDD') || '-' || lpad(v_count::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_number ON public.trade_ins;
CREATE TRIGGER trg_trade_number
  BEFORE INSERT ON public.trade_ins
  FOR EACH ROW EXECUTE FUNCTION public.set_trade_number();

REVOKE EXECUTE ON FUNCTION public.set_trade_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_trade_number() TO authenticated;

-- ============================================================
-- 6. CHAT_CONVERSATIONS (Canlı Destek)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_name text,
  customer_email text,
  status text NOT NULL DEFAULT 'OPEN',
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_conv_select_own_or_admin" ON public.chat_conversations;
CREATE POLICY "chat_conv_select_own_or_admin" ON public.chat_conversations FOR SELECT
  TO authenticated USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "chat_conv_insert_own" ON public.chat_conversations;
CREATE POLICY "chat_conv_insert_own" ON public.chat_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "chat_conv_update_own_or_admin" ON public.chat_conversations;
CREATE POLICY "chat_conv_update_own_or_admin" ON public.chat_conversations FOR UPDATE
  TO authenticated USING (public.is_admin() OR user_id = auth.uid()) WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- ============================================================
-- 7. CHAT_MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'customer',
  message text,
  image_url text,
  attachment jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_msg_select_own_or_admin" ON public.chat_messages;
CREATE POLICY "chat_msg_select_own_or_admin" ON public.chat_messages FOR SELECT
  TO authenticated USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "chat_msg_insert_own_or_admin" ON public.chat_messages;
CREATE POLICY "chat_msg_insert_own_or_admin" ON public.chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- ============================================================
-- 8. FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_at_favorite numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON public.favorites;
CREATE POLICY "favorites_select_own" ON public.favorites FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
CREATE POLICY "favorites_insert_own" ON public.favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
CREATE POLICY "favorites_delete_own" ON public.favorites FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 9. STOCK_ALERTS (Stok gelince haber ver)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  notify_method text NOT NULL DEFAULT 'app',
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_alerts_select_own" ON public.stock_alerts;
CREATE POLICY "stock_alerts_select_own" ON public.stock_alerts FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "stock_alerts_insert_own" ON public.stock_alerts;
CREATE POLICY "stock_alerts_insert_own" ON public.stock_alerts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "stock_alerts_delete_own" ON public.stock_alerts;
CREATE POLICY "stock_alerts_delete_own" ON public.stock_alerts FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 10. CAMPAIGNS (Kampanyalar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  min_cart_amount numeric DEFAULT 0,
  product_ids uuid[] DEFAULT '{}',
  category_ids uuid[] DEFAULT '{}',
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_select_any" ON public.campaigns;
CREATE POLICY "campaigns_select_any" ON public.campaigns FOR SELECT
  TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "campaigns_insert_admin" ON public.campaigns;
CREATE POLICY "campaigns_insert_admin" ON public.campaigns FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "campaigns_update_admin" ON public.campaigns;
CREATE POLICY "campaigns_update_admin" ON public.campaigns FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "campaigns_delete_admin" ON public.campaigns;
CREATE POLICY "campaigns_delete_admin" ON public.campaigns FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 11. LOYALTY_POINTS (Sadakat Puanları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE,
  points integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_select_own_or_admin" ON public.loyalty_points;
CREATE POLICY "loyalty_select_own_or_admin" ON public.loyalty_points FOR SELECT
  TO authenticated USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "loyalty_update_admin" ON public.loyalty_points;
CREATE POLICY "loyalty_update_admin" ON public.loyalty_points FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 12. STORE_SETTINGS (Mağaza Ayarları - tek satır)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.store_settings (
  id integer PRIMARY KEY DEFAULT 1,
  store_name text NOT NULL DEFAULT 'MS İLETİŞİM',
  store_subtitle text NOT NULL DEFAULT 'TELEFON | AKSESUAR | TEKNİK SERVİS',
  logo_url text,
  phone text,
  email text,
  address text,
  city text DEFAULT 'Niğde',
  district text,
  working_hours text,
  whatsapp text,
  courier_fee numeric NOT NULL DEFAULT 0,
  pos_commission_rate numeric NOT NULL DEFAULT 0.0099,
  tax_rate numeric NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  loyalty_rate numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings_select_any" ON public.store_settings;
CREATE POLICY "store_settings_select_any" ON public.store_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "store_settings_update_admin" ON public.store_settings;
CREATE POLICY "store_settings_update_admin" ON public.store_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Varsayılan ayar
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. SERVICE_PHOTOS (Servis Cihaz Fotoğrafları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_type text NOT NULL DEFAULT 'intake',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_photos_select_own_or_admin" ON public.service_photos;
CREATE POLICY "service_photos_select_own_or_admin" ON public.service_photos FOR SELECT
  TO authenticated USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.service_records sr
      WHERE sr.id = service_photos.service_id AND sr.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "service_photos_insert_admin" ON public.service_photos;
CREATE POLICY "service_photos_insert_admin" ON public.service_photos FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 14. PRODUCT_REVIEWS (Müşteri Yorumları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rating integer NOT NULL DEFAULT 5,
  comment text,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_approved" ON public.product_reviews;
CREATE POLICY "reviews_select_approved" ON public.product_reviews FOR SELECT
  TO anon, authenticated USING (is_approved = true OR user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "reviews_insert_own" ON public.product_reviews;
CREATE POLICY "reviews_insert_own" ON public.product_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reviews_update_admin" ON public.product_reviews;
CREATE POLICY "reviews_update_admin" ON public.product_reviews FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_used_devices_status ON public.used_devices(status);
CREATE INDEX IF NOT EXISTS idx_used_devices_brand_model ON public.used_devices(brand, model);
CREATE INDEX IF NOT EXISTS idx_sell_phone_status ON public.sell_phone_requests(status);
CREATE INDEX IF NOT EXISTS idx_trade_ins_status ON public.trade_ins(status);
CREATE INDEX IF NOT EXISTS idx_chat_conv_status ON public.chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON public.campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_service_photos_service ON public.service_photos(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.product_reviews(product_id);
