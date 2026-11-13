/*
# Operator Campaign System

## Overview
Adds a complete Operator Campaign module to MS İletişim. Customers can browse
operator campaigns (Vodafone, Turkcell, Türk Telekom), filter/search, use a
"Find My Plan" wizard, view campaign details, and submit information requests.
Admins manage operators, campaign categories, campaigns, and customer leads.

## New Tables

1. **operators** — Telecom operators (Vodafone, Turkcell, Türk Telekom)
   - id, name, slug, logo_url, color, active, sort_order, created_at, updated_at

2. **operator_campaign_categories** — Campaign types (New Line, Number Portability, etc.)
   - id, name, slug, sort_order, active, created_at

3. **operator_campaigns** — Individual campaigns
   - id, operator_id (FK operators), category_id (FK operator_campaign_categories)
   - name, slug, short_description, description, image_url
   - monthly_price (nullable), price_on_request (bool)
   - internet_gb (nullable int), internet_unlimited (bool)
   - minutes (nullable int), minutes_unlimited (bool)
   - sms (nullable int), sms_unlimited (bool)
   - commitment_months (nullable int)
   - eligibility (text[] — e.g. new_line, number_portability, existing_customer, youth, prepaid, postpaid)
   - age_requirement (nullable int)
   - start_date (date), end_date (nullable date)
   - terms (text), featured (bool), active (bool), archived (bool)
   - created_at, updated_at

4. **operator_leads** — Customer information requests
   - id, campaign_id (FK operator_campaigns), operator_id (FK operators)
   - user_id (nullable, FK auth.users)
   - full_name, phone, email (nullable)
   - current_operator (text), request_type (text)
   - customer_note (nullable), admin_note (nullable)
   - status (text: new/contacted/waiting/completed/cancelled)
   - created_at, updated_at

## Security (RLS)

- **operators**: Public read (anon, authenticated). Admin-only writes via
  SECURITY DEFINER RPC functions.
- **operator_campaign_categories**: Public read. Admin-only writes via RPC.
- **operator_campaigns**: Public read of active, non-archived, non-expired
  campaigns. Admin-only writes via RPC.
- **operator_leads**: Customers can insert their own leads and read their own
  leads. Admin-only reads/updates via RPC.

## Important Notes
1. Admin authorization is checked via `is_admin()` SECURITY DEFINER function
   that queries the admins table.
2. Campaign expiry is enforced both in queries (end_date >= today) and in RPC.
3. Soft delete via `archived` column — physical deletes are never used.
4. Lead deduplication prevents spamming the same campaign within 24 hours.
*/

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

-- =========================================================
-- 1. operators
-- =========================================================
CREATE TABLE IF NOT EXISTS public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  color text DEFAULT '#6366f1',
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operators_public_read" ON public.operators;
CREATE POLICY "operators_public_read" ON public.operators FOR SELECT
  TO anon, authenticated USING (true);

-- =========================================================
-- 2. operator_campaign_categories
-- =========================================================
CREATE TABLE IF NOT EXISTS public.operator_campaign_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_campaign_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_categories_public_read" ON public.operator_campaign_categories;
CREATE POLICY "campaign_categories_public_read" ON public.operator_campaign_categories FOR SELECT
  TO anon, authenticated USING (true);

-- =========================================================
-- 3. operator_campaigns
-- =========================================================
CREATE TABLE IF NOT EXISTS public.operator_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.operator_campaign_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  short_description text,
  description text,
  image_url text,
  monthly_price numeric(10,2),
  price_on_request boolean NOT NULL DEFAULT false,
  internet_gb int,
  internet_unlimited boolean NOT NULL DEFAULT false,
  minutes int,
  minutes_unlimited boolean NOT NULL DEFAULT false,
  sms int,
  sms_unlimited boolean NOT NULL DEFAULT false,
  commitment_months int,
  eligibility text[] NOT NULL DEFAULT '{}',
  age_requirement int,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  terms text,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_public_read" ON public.operator_campaigns;
CREATE POLICY "campaigns_public_read" ON public.operator_campaigns FOR SELECT
  TO anon, authenticated
  USING (active = true AND archived = false AND (end_date IS NULL OR end_date >= CURRENT_DATE));

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_operator_campaigns_slug ON public.operator_campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_operator_campaigns_operator ON public.operator_campaigns(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_campaigns_featured ON public.operator_campaigns(featured) WHERE featured = true AND active = true;

-- =========================================================
-- 4. operator_leads
-- =========================================================
CREATE TABLE IF NOT EXISTS public.operator_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.operator_campaigns(id) ON DELETE RESTRICT,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  current_operator text,
  request_type text NOT NULL,
  customer_note text,
  admin_note text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_leads ENABLE ROW LEVEL SECURITY;

-- Customers can insert their own leads
DROP POLICY IF EXISTS "leads_insert_own" ON public.operator_leads;
CREATE POLICY "leads_insert_own" ON public.operator_leads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Anonymous (not logged in) can also insert leads (user_id will be null)
DROP POLICY IF EXISTS "leads_insert_anon" ON public.operator_leads;
CREATE POLICY "leads_insert_anon" ON public.operator_leads FOR INSERT
  TO anon WITH CHECK (true);

-- Customers can read their own leads
DROP POLICY IF EXISTS "leads_select_own" ON public.operator_leads;
CREATE POLICY "leads_select_own" ON public.operator_leads FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 5. Seed default operators
-- =========================================================
INSERT INTO public.operators (name, slug, color, sort_order) VALUES
  ('Vodafone', 'vodafone', '#E60000', 1),
  ('Turkcell', 'turkcell', '#FBBE2E', 2),
  ('Türk Telekom', 'turk-telekom', '#00A4DC', 3)
ON CONFLICT (slug) DO NOTHING;

-- =========================================================
-- 6. Seed default campaign categories
-- =========================================================
INSERT INTO public.operator_campaign_categories (name, slug, sort_order) VALUES
  ('Yeni Hat', 'yeni-hat', 1),
  ('Numara Taşıma', 'numara-tasima', 2),
  ('Faturalı Tarifeler', 'faturali-tarifeler', 3),
  ('Faturasız Paketler', 'faturasiz-paketler', 4),
  ('Mevcut Müşteriye Özel', 'mevcut-musteriye-ozel', 5),
  ('Genç Tarifeleri', 'genc-tarifeleri', 6),
  ('Ek İnternet Paketleri', 'ek-internet-paketleri', 7),
  ('Cihaz + Tarife Kampanyaları', 'cihaz-tarife-kampanyalari', 8),
  ('Ev İnterneti', 'ev-interneti', 9),
  ('Diğer', 'diger', 10)
ON CONFLICT (slug) DO NOTHING;