/*
# Kritik runtime hata duzeltmeleri

## 1. set_order_status fonksiyonunda tanimsiz degisken (v_order_id)
602. satirda `WHERE id = v_order_id` kullaniliyor ama v_order_id
degiskeni DECLARE blokunda tanimlanmamis. Dogrusu `p_order_id` olmali.
Bu hata admin her siparis durumu degistirmeye calistiginda SQL hatasi veriyor.

## 2. auth.users INSERT trigger - otomatik profil olusturma
Kayit sirasinda profiles tablosuna insert yapilirken RLS politikasi
`id = auth.uid()` kontrolu yapiyor. Email confirmation kapali olsa da,
signUp sonrasi session henuz tam oturmamis olabilir ve auth.uid() NULL
donebilir. Bu durumda profil satiri olusmuyor ve kullanici bos profil goruyor.
Cozum: auth.users INSERT sonrasi otomatik profil olusturan bir trigger
ekliyoruz. Trigger SECURITY DEFINER olarak RLS'i asar ve garanti eder.

## 3. admins_count() fonksiyonu - guvenilir admin sayisi kontrolu
AdminLayout'da admins tablosunu sorgularken RLS nedeniyle normal
kullanicilar 0 sonucu aliyor (kendi user_id'si tabloda yoksa).
Bu yuzden her kullaniciya "ilk admin" ekranini gosteriyor.
Cozum: admins_count() SECURITY DEFINER fonksiyonu ile gercek admin sayisini aliyoruz.
*/

-- ============================================================
-- 1. set_order_status duzeltmesi
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

  -- Durum guncelle (duzeltildi: v_order_id -> p_order_id)
  UPDATE public.orders SET status = p_status WHERE id = p_order_id;

  -- Teslim edildi: odeme durumunu 'paid' yap ve satis kayitlari olustur
  IF p_status = 'delivered' THEN
    UPDATE public.orders SET payment_status = 'paid' WHERE id = p_order_id;

    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE order_id = p_order_id) THEN
      FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
      LOOP
        v_cost := 0;
        SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
        IF FOUND THEN
          v_cost := v_product.cost_price;
        ELSE
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
-- 2. auth.users INSERT trigger - otomatik profil olusturma
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. admins_count() fonksiyonu
-- ============================================================

CREATE OR REPLACE FUNCTION public.admins_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.admins;
$$;

REVOKE EXECUTE ON FUNCTION public.admins_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admins_count() TO authenticated;
