/*
# MS İletişim - Finansal Sistem Altyapısı (Bölüm 1: Temel Tablolar)

## Genel Açıklama
Mevcut e-ticaret sistemine finansal altyapı ekler. Mevcut tablolar (products, orders, order_items, sales, profiles, addresses, categories, notifications, admins) korunur. Yeni tablolar eklenir ve mevcut tablolara gerekli kolonlar eklenir.

## Yeni Tablolar
1. **suppliers** - Tedarikçi bilgileri
2. **service_records** - Teknik servis kayıtları
3. **service_parts** - Servis parça kalemleri
4. **deliveries** - Teslimat/kurye kayıtları
5. **delivery_slots** - Kurye saat aralıkları
6. **stock_movements** - Stok hareket geçmişi
7. **payments** - Ödeme kayıtları (parçalı ödeme desteği)
8. **cash_transactions** - Kasa hareketleri
9. **bank_transactions** - Banka hareketleri
10. **card_transactions** - Kredi kartı hareketleri
11. **expenses** - Gider kayıtları
12. **returns** - İade kayıtları
13. **return_items** - İade kalemleri
14. **daily_closings** - Gün sonu kapanışları
15. **audit_logs** - Denetim günlüğü

## Mevcut Tablolara Eklenen Kolonlar
- **orders**: sales_channel, delivery_type, delivery_slot_id, assigned_courier_id, subtotal, discount
- **order_items**: cost_price, discount, imei (satış anındaki maliyeti korumak için)
- **products**: barcode, supplier_id, min_stock_level, warranty_start_date, condition_notes, replaced_parts, is_second_hand

## Güvenlik
- Tüm yeni tablolarda RLS etkinleştirilir
- Admin işlemleri is_admin() ile, müşteri işlemleri auth.uid() ile kontrol edilir
*/

-- ============================================================
-- 1. SUPPLIERS (Tedarikçiler)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  tax_no text,
  contact_person text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_admin" ON public.suppliers;
CREATE POLICY "suppliers_select_admin" ON public.suppliers FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "suppliers_insert_admin" ON public.suppliers;
CREATE POLICY "suppliers_insert_admin" ON public.suppliers FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "suppliers_update_admin" ON public.suppliers;
CREATE POLICY "suppliers_update_admin" ON public.suppliers FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "suppliers_delete_admin" ON public.suppliers;
CREATE POLICY "suppliers_delete_admin" ON public.suppliers FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 2. PRODUCTS tablosuna yeni kolonlar
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='barcode') THEN
    ALTER TABLE public.products ADD COLUMN barcode text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='supplier_id') THEN
    ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='min_stock_level') THEN
    ALTER TABLE public.products ADD COLUMN min_stock_level integer NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='warranty_start_date') THEN
    ALTER TABLE public.products ADD COLUMN warranty_start_date date;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='condition_notes') THEN
    ALTER TABLE public.products ADD COLUMN condition_notes text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='replaced_parts') THEN
    ALTER TABLE public.products ADD COLUMN replaced_parts text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='is_second_hand') THEN
    ALTER TABLE public.products ADD COLUMN is_second_hand boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- IMEI unique constraint (aynı IMEI iki aktif stokta olamaz)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_imei_unique_active') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_imei_unique_active UNIQUE (imei) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ============================================================
-- 3. ORDERS tablosuna yeni kolonlar
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='sales_channel') THEN
    ALTER TABLE public.orders ADD COLUMN sales_channel text NOT NULL DEFAULT 'ONLINE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_type') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_type text NOT NULL DEFAULT 'GEL_AL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_slot_id') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_slot_id uuid;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='assigned_courier_id') THEN
    ALTER TABLE public.orders ADD COLUMN assigned_courier_id uuid;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='subtotal') THEN
    ALTER TABLE public.orders ADD COLUMN subtotal numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='discount') THEN
    ALTER TABLE public.orders ADD COLUMN discount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 4. ORDER_ITEMS tablosuna yeni kolonlar
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='cost_price') THEN
    ALTER TABLE public.order_items ADD COLUMN cost_price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='discount') THEN
    ALTER TABLE public.order_items ADD COLUMN discount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='imei') THEN
    ALTER TABLE public.order_items ADD COLUMN imei text;
  END IF;
END $$;

-- ============================================================
-- 5. DELIVERY_SLOTS (Kurye saat aralıkları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_slots_select_any" ON public.delivery_slots;
CREATE POLICY "delivery_slots_select_any" ON public.delivery_slots FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "delivery_slots_insert_admin" ON public.delivery_slots;
CREATE POLICY "delivery_slots_insert_admin" ON public.delivery_slots FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "delivery_slots_update_admin" ON public.delivery_slots;
CREATE POLICY "delivery_slots_update_admin" ON public.delivery_slots FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "delivery_slots_delete_admin" ON public.delivery_slots;
CREATE POLICY "delivery_slots_delete_admin" ON public.delivery_slots FOR DELETE
  TO authenticated USING (public.is_admin());

-- Varsayılan saat aralıkları
INSERT INTO public.delivery_slots (label, start_time, end_time, sort_order) VALUES
  ('10:00 - 12:00', '10:00', '12:00', 1),
  ('12:00 - 14:00', '12:00', '14:00', 2),
  ('14:00 - 16:00', '14:00', '16:00', 3),
  ('16:00 - 18:00', '16:00', '18:00', 4),
  ('18:00 - 20:00', '18:00', '20:00', 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. DELIVERIES (Teslimat/Kurye kayıtları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id uuid,
  delivery_type text NOT NULL DEFAULT 'KURYE',
  status text NOT NULL DEFAULT 'PENDING',
  slot_id uuid REFERENCES public.delivery_slots(id) ON DELETE SET NULL,
  scheduled_date date,
  address text,
  phone text,
  notes text,
  collected_amount numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select_admin" ON public.deliveries;
CREATE POLICY "deliveries_select_admin" ON public.deliveries FOR SELECT
  TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = deliveries.order_id AND orders.user_id = auth.uid()));
DROP POLICY IF EXISTS "deliveries_insert_admin" ON public.deliveries;
CREATE POLICY "deliveries_insert_admin" ON public.deliveries FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "deliveries_update_admin" ON public.deliveries;
CREATE POLICY "deliveries_update_admin" ON public.deliveries FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 7. STOCK_MOVEMENTS (Stok hareket geçmişi)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  order_id uuid,
  sale_id uuid,
  user_id uuid,
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select_admin" ON public.stock_movements;
CREATE POLICY "stock_movements_select_admin" ON public.stock_movements FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "stock_movements_insert_admin" ON public.stock_movements;
CREATE POLICY "stock_movements_insert_admin" ON public.stock_movements FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 8. PAYMENTS (Ödeme kayıtları - parçalı ödeme desteği)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED',
  collected_by uuid,
  collected_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin" ON public.payments FOR SELECT
  TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()));
DROP POLICY IF EXISTS "payments_insert_admin" ON public.payments;
CREATE POLICY "payments_insert_admin" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 9. CASH_TRANSACTIONS (Kasa hareketleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  direction text NOT NULL,
  balance_after numeric,
  source_type text NOT NULL,
  source_id uuid,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_tx_select_admin" ON public.cash_transactions;
CREATE POLICY "cash_tx_select_admin" ON public.cash_transactions FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "cash_tx_insert_admin" ON public.cash_transactions;
CREATE POLICY "cash_tx_insert_admin" ON public.cash_transactions FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 10. BANK_TRANSACTIONS (Banka hareketleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  direction text NOT NULL,
  balance_after numeric,
  source_type text NOT NULL,
  source_id uuid,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_tx_select_admin" ON public.bank_transactions;
CREATE POLICY "bank_tx_select_admin" ON public.bank_transactions FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "bank_tx_insert_admin" ON public.bank_transactions;
CREATE POLICY "bank_tx_insert_admin" ON public.bank_transactions FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 11. CARD_TRANSACTIONS (Kredi kartı hareketleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  direction text NOT NULL,
  balance_after numeric,
  source_type text NOT NULL,
  source_id uuid,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_tx_select_admin" ON public.card_transactions;
CREATE POLICY "card_tx_select_admin" ON public.card_transactions FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "card_tx_insert_admin" ON public.card_transactions;
CREATE POLICY "card_tx_insert_admin" ON public.card_transactions FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 12. EXPENSES (Giderler)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text,
  amount numeric NOT NULL,
  payment_type text NOT NULL DEFAULT 'KASA',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_admin" ON public.expenses;
CREATE POLICY "expenses_select_admin" ON public.expenses FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "expenses_insert_admin" ON public.expenses;
CREATE POLICY "expenses_insert_admin" ON public.expenses FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "expenses_delete_admin" ON public.expenses;
CREATE POLICY "expenses_delete_admin" ON public.expenses FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 13. RETURNS (İade kayıtları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  return_number text NOT NULL,
  reason text,
  total_refund numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'COMPLETED',
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns_select_admin" ON public.returns;
CREATE POLICY "returns_select_admin" ON public.returns FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "returns_insert_admin" ON public.returns;
CREATE POLICY "returns_insert_admin" ON public.returns FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 14. RETURN_ITEMS (İade kalemleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  refund_amount numeric NOT NULL,
  restock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_items_select_admin" ON public.return_items;
CREATE POLICY "return_items_select_admin" ON public.return_items FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "return_items_insert_admin" ON public.return_items;
CREATE POLICY "return_items_insert_admin" ON public.return_items FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 15. DAILY_CLOSINGS (Gün sonu kapanışları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date date NOT NULL UNIQUE,
  cash_total numeric NOT NULL DEFAULT 0,
  card_total numeric NOT NULL DEFAULT 0,
  bank_total numeric NOT NULL DEFAULT 0,
  total_sales numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  gross_profit numeric NOT NULL DEFAULT 0,
  pos_commission numeric NOT NULL DEFAULT 0,
  expenses_total numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  starting_cash numeric NOT NULL DEFAULT 0,
  ending_cash numeric NOT NULL DEFAULT 0,
  card_balance_before numeric NOT NULL DEFAULT 0,
  card_transferred_to_bank numeric NOT NULL DEFAULT 0,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_closings_select_admin" ON public.daily_closings;
CREATE POLICY "daily_closings_select_admin" ON public.daily_closings FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "daily_closings_insert_admin" ON public.daily_closings;
CREATE POLICY "daily_closings_insert_admin" ON public.daily_closings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 16. AUDIT_LOGS (Denetim günlüğü)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 17. SERVICE_RECORDS (Teknik servis kayıtları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_number text NOT NULL,
  user_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  device_brand text,
  device_model text,
  imei text,
  issue_description text,
  work_to_be_done text,
  parts_cost numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  service_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'RECEIVED',
  notes text,
  pickup_requested boolean NOT NULL DEFAULT false,
  pickup_address text,
  pickup_phone text,
  pickup_date date,
  pickup_slot_id uuid REFERENCES public.delivery_slots(id) ON DELETE SET NULL,
  delivery_type text,
  delivery_address text,
  delivery_slot_id uuid REFERENCES public.delivery_slots(id) ON DELETE SET NULL,
  quoted_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  delivered_at timestamptz,
  paid_at timestamptz,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_select_admin" ON public.service_records;
CREATE POLICY "service_select_admin" ON public.service_records FOR SELECT
  TO authenticated USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "service_insert_own_or_admin" ON public.service_records;
CREATE POLICY "service_insert_own_or_admin" ON public.service_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "service_update_admin" ON public.service_records;
CREATE POLICY "service_update_admin" ON public.service_records FOR UPDATE
  TO authenticated USING (public.is_admin() OR user_id = auth.uid()) WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- Service number trigger
CREATE OR REPLACE FUNCTION public.set_service_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_date text;
  v_number text;
BEGIN
  v_date := to_char(now(), 'YYMMDD');
  SELECT count(*) + 1 INTO v_count FROM public.service_records WHERE created_at::date = now()::date;
  v_number := 'SRV-' || v_date || '-' || lpad(v_count::text, 4, '0');
  NEW.service_number := v_number;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_number ON public.service_records;
CREATE TRIGGER trg_service_number
  BEFORE INSERT ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION public.set_service_number();

REVOKE EXECUTE ON FUNCTION public.set_service_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_service_number() TO authenticated;

-- ============================================================
-- 18. SERVICE_PARTS (Servis parça kalemleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  cost_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_parts_select_admin" ON public.service_parts;
CREATE POLICY "service_parts_select_admin" ON public.service_parts FOR SELECT
  TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.service_records sr WHERE sr.id = service_parts.service_id AND sr.user_id = auth.uid()));
DROP POLICY IF EXISTS "service_parts_insert_admin" ON public.service_parts;
CREATE POLICY "service_parts_insert_admin" ON public.service_parts FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_imei ON public.products(imei) WHERE imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sales_channel ON public.orders(sales_channel);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON public.orders(delivery_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_cash_tx_created_at ON public.cash_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_bank_tx_created_at ON public.bank_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_card_tx_created_at ON public.card_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON public.returns(order_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON public.daily_closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_service_records_status ON public.service_records(status);
CREATE INDEX IF NOT EXISTS idx_service_records_user_id ON public.service_records(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
