/*
# KVKK, Açık Rıza ve Ticari İletişim Sistemi

## Amaç
MS İletişim uygulamasına KVKK (Kişisel Verilerin Korunması Kanunu) uyumluluğu için:
- Versiyonlanmış hukuki metin yönetimi
- Kullanıcı aydınlatma/onay takibi
- Ticari elektronik iletişim izinleri (SMS, e-posta, telefon, push)
- İzin geçmişi (audit trail)
- KVKK başvuru yönetimi
sistemini ekler.

## Yeni Tablolar
1. legal_documents — Versiyonlanmış hukuki metinler (KVKK, açık rıza, vb.)
2. user_legal_acknowledgements — Hangi kullanıcının hangi metnin hangi sürümünü ne zaman gördü/onayladığı
3. consent_logs — İzin geçmişi (ticari iletişim kanal bazında, audit trail)
4. kvkk_requests — KVKK başvuruları (veri talepleri)

## Değiştirilen Tablolar
- store_settings: KVKK iletişim bilgileri için yeni sütunlar eklendi (kvkk_email, company_title, company_address)

## Güvenlik
- Tüm yeni tablolarda RLS etkin
- Kullanıcılar kendi izin geçmişini ve başvurularını görebilir ama değiştiremez
- Adminler tüm kayıtları görebilir ama izinleri keyfi olarak değiştiremez
- legal_documents: aktif metinler herkese açık (anon), admin CRUD
- kvkk_requests: kullanıcı kendi başvurusunu oluşturabilir, admin görebilir
*/

-- =========================================================================
-- 1. store_settings'e KVKK alanları ekle
-- =========================================================================
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS company_title text,
  ADD COLUMN IF NOT EXISTS kvkk_email text,
  ADD COLUMN IF NOT EXISTS company_address text;

-- =========================================================================
-- 2. legal_documents tablosu
-- =========================================================================
CREATE TABLE IF NOT EXISTS legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('kvkk_notice', 'explicit_consent', 'commercial_communication', 'privacy')),
  title text NOT NULL,
  content text NOT NULL,
  version text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Her document_type için sadece bir aktif metin olabilir
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_documents_active_per_type
  ON legal_documents (document_type) WHERE is_active = true;

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

-- Aktif metinler herkes tarafından okunabilir (public KVKK sayfası için)
DROP POLICY IF EXISTS "public_read_active_legal_documents" ON legal_documents;
CREATE POLICY "public_read_active_legal_documents"
  ON legal_documents FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Adminler tüm metinleri okuyabilir
DROP POLICY IF EXISTS "admin_read_all_legal_documents" ON legal_documents;
CREATE POLICY "admin_read_all_legal_documents"
  ON legal_documents FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- Adminler metin oluşturabilir
DROP POLICY IF EXISTS "admin_insert_legal_documents" ON legal_documents;
CREATE POLICY "admin_insert_legal_documents"
  ON legal_documents FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- Adminler metin güncelleyebilir
DROP POLICY IF EXISTS "admin_update_legal_documents" ON legal_documents;
CREATE POLICY "admin_update_legal_documents"
  ON legal_documents FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- Adminler metin silebilir
DROP POLICY IF EXISTS "admin_delete_legal_documents" ON legal_documents;
CREATE POLICY "admin_delete_legal_documents"
  ON legal_documents FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- =========================================================================
-- 3. user_legal_acknowledgements tablosu
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_legal_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  document_version text NOT NULL,
  acknowledged_at timestamptz DEFAULT now(),
  source text NOT NULL DEFAULT 'registration' CHECK (source IN ('registration', 'checkout', 'service', 'account_settings', 'admin', 'store'))
);

CREATE INDEX IF NOT EXISTS idx_user_legal_ack_user ON user_legal_acknowledgements (user_id);
CREATE INDEX IF NOT EXISTS idx_user_legal_ack_doc ON user_legal_acknowledgements (document_id);

ALTER TABLE user_legal_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi onay kayıtlarını görebilir
DROP POLICY IF EXISTS "user_read_own_acknowledgements" ON user_legal_acknowledgements;
CREATE POLICY "user_read_own_acknowledgements"
  ON user_legal_acknowledgements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Kullanıcı kendi onay kaydını oluşturabilir
DROP POLICY IF EXISTS "user_insert_own_acknowledgements" ON user_legal_acknowledgements;
CREATE POLICY "user_insert_own_acknowledgements"
  ON user_legal_acknowledgements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin tüm onay kayıtlarını görebilir
DROP POLICY IF EXISTS "admin_read_all_acknowledgements" ON user_legal_acknowledgements;
CREATE POLICY "admin_read_all_acknowledgements"
  ON user_legal_acknowledgements FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- =========================================================================
-- 4. consent_logs tablosu (audit trail)
-- =========================================================================
CREATE TABLE IF NOT EXISTS consent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('commercial_communication', 'kvkk_notice', 'explicit_consent')),
  channel text CHECK (channel IN ('sms', 'email', 'phone', 'push') OR channel IS NULL),
  status text NOT NULL CHECK (status IN ('granted', 'revoked')),
  document_version text,
  source text NOT NULL DEFAULT 'registration' CHECK (source IN ('registration', 'checkout', 'service', 'account_settings', 'admin', 'store')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_user ON consent_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_type ON consent_logs (consent_type, channel);

ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi izin geçmişini görebilir (read-only)
DROP POLICY IF EXISTS "user_read_own_consent_logs" ON consent_logs;
CREATE POLICY "user_read_own_consent_logs"
  ON consent_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Kullanıcı kendi izin kaydı oluşturabilir (izin verme/geri çekme)
DROP POLICY IF EXISTS "user_insert_own_consent_logs" ON consent_logs;
CREATE POLICY "user_insert_own_consent_logs"
  ON consent_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin tüm izin geçmişini görebilir
DROP POLICY IF EXISTS "admin_read_all_consent_logs" ON consent_logs;
CREATE POLICY "admin_read_all_consent_logs"
  ON consent_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- =========================================================================
-- 5. kvkk_requests tablosu
-- =========================================================================
CREATE TABLE IF NOT EXISTS kvkk_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  email text NOT NULL,
  subject text NOT NULL CHECK (subject IN ('info_request', 'correction', 'deletion', 'preference_change', 'other')),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'rejected')),
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kvkk_requests_user ON kvkk_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_kvkk_requests_status ON kvkk_requests (status);

ALTER TABLE kvkk_requests ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi başvurularını görebilir
DROP POLICY IF EXISTS "user_read_own_kvkk_requests" ON kvkk_requests;
CREATE POLICY "user_read_own_kvkk_requests"
  ON kvkk_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Kullanıcı (giriş yapmış) başvuru oluşturabilir
DROP POLICY IF EXISTS "user_insert_own_kvkk_requests" ON kvkk_requests;
CREATE POLICY "user_insert_own_kvkk_requests"
  ON kvkk_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Ziyaretçi (anon) de KVKK başvurusu yapabilmeli (giriş yapmamış kullanıcılar için)
DROP POLICY IF EXISTS "anon_insert_kvkk_requests" ON kvkk_requests;
CREATE POLICY "anon_insert_kvkk_requests"
  ON kvkk_requests FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Admin tüm başvuruları görebilir
DROP POLICY IF EXISTS "admin_read_all_kvkk_requests" ON kvkk_requests;
CREATE POLICY "admin_read_all_kvkk_requests"
  ON kvkk_requests FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- Admin başvuru durumunu güncelleyebilir
DROP POLICY IF EXISTS "admin_update_kvkk_requests" ON kvkk_requests;
CREATE POLICY "admin_update_kvkk_requests"
  ON kvkk_requests FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- =========================================================================
-- 6. RPC: Kullanıcının mevcut iletişim tercihlerini getir
-- =========================================================================
CREATE OR REPLACE FUNCTION get_user_consent_preferences(p_user_id uuid)
RETURNS TABLE (
  consent_type text,
  channel text,
  status text,
  latest_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (cl.consent_type, COALESCE(cl.channel, ''))
    cl.consent_type,
    cl.channel,
    cl.status,
    cl.created_at AS latest_at
  FROM consent_logs cl
  WHERE cl.user_id = p_user_id
  ORDER BY cl.consent_type, COALESCE(cl.channel, ''), cl.created_at DESC;
$$;

-- =========================================================================
-- 7. İlk KVKK metnini ekle (v1.0)
-- =========================================================================
INSERT INTO legal_documents (document_type, title, content, version, is_active, published_at)
SELECT 'kvkk_notice', 'KVKK Aydınlatma Metni', '', '1.0', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM legal_documents WHERE document_type = 'kvkk_notice' AND version = '1.0'
);

-- =========================================================================
-- 8. updated_at trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legal_documents_updated ON legal_documents;
CREATE TRIGGER trg_legal_documents_updated BEFORE UPDATE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_kvkk_requests_updated ON kvkk_requests;
CREATE TRIGGER trg_kvkk_requests_updated BEFORE UPDATE ON kvkk_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
