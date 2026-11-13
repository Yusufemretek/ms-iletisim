/*
# Kredi Kartı Taksit Sistemi - Veritabanı Altyapısı

## Genel Açıklama
Kredi kartı ödemelerinde taksit seçeneği ekler. Taksit ayarları veritabanında tutulur (hardcode değil).
Taksit YALNIZCA kredi kartı ödeme yönteminde çalışır. Nakit, havale, IBAN için backend reddeder.

## Yeni Tablolar
1. **installment_settings** - Her taksit sayısı için aktiflik, vade farkı ve komisyon oranı
2. **card_payment_details** - Kredi kartı ödeme detayları (transaction_id, provider, masked_card, taksit bilgileri)

## Mevcut Tablolara Eklenen Kolonlar
- **orders**: installment_count, installment_monthly_amount, installment_total, interest_amount, pos_commission_amount, net_amount
- **payments**: installment_count, installment_monthly_amount, installment_total, interest_amount, pos_commission_amount, net_amount, transaction_id, payment_provider, masked_card, payment_status_detail

## Güvenlik
- installment_settings: anon okuyabilir (müşteri taksit seçeneklerini görmeli), admin yazabilir
- card_payment_details: admin okuyabilir, ilgili siparişin sahibi okuyabilir
*/

-- ============================================================
-- 1. INSTALLMENT_SETTINGS (Taksit Ayarları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.installment_settings (
  id integer PRIMARY KEY,
  installment_count integer NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  interest_rate numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0.0099,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.installment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installment_settings_select_any" ON public.installment_settings;
CREATE POLICY "installment_settings_select_any" ON public.installment_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "installment_settings_update_admin" ON public.installment_settings;
CREATE POLICY "installment_settings_update_admin" ON public.installment_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "installment_settings_insert_admin" ON public.installment_settings;
CREATE POLICY "installment_settings_insert_admin" ON public.installment_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- Varsayılan taksit ayarları
INSERT INTO public.installment_settings (id, installment_count, label, is_active, interest_rate, commission_rate, sort_order) VALUES
  (1, 1, 'Tek Çekim', true, 0, 0.0099, 1),
  (2, 3, '3 Taksit', true, 0.02, 0.0199, 2),
  (3, 6, '6 Taksit', true, 0.05, 0.0299, 3),
  (4, 9, '9 Taksit', true, 0.08, 0.0399, 4),
  (5, 12, '12 Taksit', true, 0.12, 0.0499, 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. ORDERS tablosuna taksit kolonları
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='installment_count') THEN
    ALTER TABLE public.orders ADD COLUMN installment_count integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='installment_monthly_amount') THEN
    ALTER TABLE public.orders ADD COLUMN installment_monthly_amount numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='installment_total') THEN
    ALTER TABLE public.orders ADD COLUMN installment_total numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='interest_amount') THEN
    ALTER TABLE public.orders ADD COLUMN interest_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='pos_commission_amount') THEN
    ALTER TABLE public.orders ADD COLUMN pos_commission_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='net_amount') THEN
    ALTER TABLE public.orders ADD COLUMN net_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 3. PAYMENTS tablosuna taksit kolonları
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='installment_count') THEN
    ALTER TABLE public.payments ADD COLUMN installment_count integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='installment_monthly_amount') THEN
    ALTER TABLE public.payments ADD COLUMN installment_monthly_amount numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='installment_total') THEN
    ALTER TABLE public.payments ADD COLUMN installment_total numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='interest_amount') THEN
    ALTER TABLE public.payments ADD COLUMN interest_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='pos_commission_amount') THEN
    ALTER TABLE public.payments ADD COLUMN pos_commission_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='net_amount') THEN
    ALTER TABLE public.payments ADD COLUMN net_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='transaction_id') THEN
    ALTER TABLE public.payments ADD COLUMN transaction_id text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='payment_provider') THEN
    ALTER TABLE public.payments ADD COLUMN payment_provider text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='masked_card') THEN
    ALTER TABLE public.payments ADD COLUMN masked_card text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='payment_status_detail') THEN
    ALTER TABLE public.payments ADD COLUMN payment_status_detail text;
  END IF;
END $$;

-- ============================================================
-- 4. CARD_PAYMENT_DETAILS (Kart Ödeme Detayları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.card_payment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  installment_count integer NOT NULL DEFAULT 1,
  interest_rate numeric NOT NULL DEFAULT 0,
  interest_amount numeric NOT NULL DEFAULT 0,
  customer_total numeric NOT NULL DEFAULT 0,
  monthly_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  transaction_id text,
  provider text,
  masked_card text,
  payment_status text NOT NULL DEFAULT 'PENDING',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.card_payment_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_details_select_admin" ON public.card_payment_details;
CREATE POLICY "card_details_select_admin" ON public.card_payment_details FOR SELECT
  TO authenticated USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.id = card_payment_details.payment_id AND o.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "card_details_insert_admin" ON public.card_payment_details;
CREATE POLICY "card_details_insert_admin" ON public.card_payment_details FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "card_details_update_admin" ON public.card_payment_details;
CREATE POLICY "card_details_update_admin" ON public.card_payment_details FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 5. PRODUCTS tablosuna taksit override kolonu
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='allowed_installments') THEN
    ALTER TABLE public.products ADD COLUMN allowed_installments integer[] DEFAULT '{1,3,6,9,12}';
  END IF;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_installment_settings_count ON public.installment_settings(installment_count);
CREATE INDEX IF NOT EXISTS idx_card_details_payment ON public.card_payment_details(payment_id);
CREATE INDEX IF NOT EXISTS idx_card_details_idempotency ON public.card_payment_details(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_installment ON public.payments(installment_count) WHERE installment_count IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_installment ON public.orders(installment_count) WHERE installment_count IS NOT NULL;
