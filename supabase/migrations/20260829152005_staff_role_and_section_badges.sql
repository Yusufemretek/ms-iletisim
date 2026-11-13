/*
# Personel Rol ve Bölüm Atama Sistemi + Bildirim Rozetleri

1. Amaç
- Admin panelinde her bölüm (satış, canlı destek, servis teklifi, cihaz teklifi) için
  ayrı personel tanımlanabilmesi.
- Her personelin sadece kendi bölümüne ait bildirimleri görmesi.
- Süper admin her şeyi görebilir.
- Admin menüsünde her bölüm için okunmamış bildirim sayısını gösteren rozet.

2. Değişiklikler
- `admins` tablosuna `role` (text) ve `assigned_sections` (text[]) kolonları eklendi.
  - role: 'super_admin' | 'staff'
  - assigned_sections: ['orders', 'support', 'service', 'trade_ins', 'sell_phone']
  - super_admin tüm bölümleri görür, staff sadece atanan bölümleri.
- `is_admin()` fonksiyonu güncellendi: super_admin VE staff için true döner.
- Yeni RPC'ler: get_staff_members, update_staff_member, add_staff_member, remove_staff_member,
  get_my_sections, get_unread_counts_by_section, is_super_admin.

3. Güvenlik
- `admins` tablosunda RLS aktif.
- Sadece super_admin CRUD yapabilir (staff kendi kaydını okuyabilir).
- Tüm RPC'ler SECURITY DEFINER, sadece authenticated çağırabilir.
*/

-- admins tablosuna role ve assigned_sections ekle
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'super_admin';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS assigned_sections text[] NOT NULL DEFAULT ARRAY['orders','support','service','trade_ins','sell_phone']::text[];

-- Mevcut adminleri super_admin yap
UPDATE admins SET role = 'super_admin' WHERE role IS NULL OR role = '';
UPDATE admins SET assigned_sections = ARRAY['orders','support','service','trade_ins','sell_phone']::text[] WHERE assigned_sections IS NULL;

-- is_admin fonksiyonunu güncelle: hem super_admin hem staff için true döner
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$function$;

-- is_super_admin fonksiyonu
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND role = 'super_admin');
$function$;

-- get_my_sections: giriş yapmış adminin atanan bölümleri
CREATE OR REPLACE FUNCTION public.get_my_sections()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT COALESCE(
  (SELECT assigned_sections FROM public.admins WHERE user_id = auth.uid()),
  ARRAY[]::text[]
);
$function$;

-- get_staff_members: tüm admin personel listesi (sadece super_admin)
CREATE OR REPLACE FUNCTION public.get_staff_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  assigned_sections text[],
  first_name text,
  last_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: sadece süper admin personel listesini görebilir';
  END IF;
  RETURN QUERY
  SELECT a.user_id, p.email, a.role, a.assigned_sections, p.first_name, p.last_name, a.created_at
  FROM public.admins a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.created_at;
END;
$function$;

-- add_staff_member: yeni personel ekle (sadece super_admin)
CREATE OR REPLACE FUNCTION public.add_staff_member(
  p_user_id uuid,
  p_role text DEFAULT 'staff',
  p_sections text[] DEFAULT ARRAY['orders','support','service','trade_ins','sell_phone']::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: sadece süper admin personel ekleyebilir';
  END IF;
  INSERT INTO public.admins (user_id, role, assigned_sections)
  VALUES (p_user_id, p_role, p_sections)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, assigned_sections = EXCLUDED.assigned_sections;
END;
$function$;

-- update_staff_member: personel güncelle (sadece super_admin)
CREATE OR REPLACE FUNCTION public.update_staff_member(
  p_user_id uuid,
  p_role text,
  p_sections text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: sadece süper admin personel güncelleyebilir';
  END IF;
  UPDATE public.admins
  SET role = p_role, assigned_sections = p_sections
  WHERE user_id = p_user_id;
END;
$function$;

-- remove_staff_member: personeli kaldır (sadece super_admin, kendini silemez)
CREATE OR REPLACE FUNCTION public.remove_staff_member(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: sadece süper admin personel kaldırabilir';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Kendinizi silemezsiniz';
  END IF;
  DELETE FROM public.admins WHERE user_id = p_user_id;
END;
$function$;

-- get_unread_counts_by_section: her bölüm için okunmamış bildirim sayısı
CREATE OR REPLACE FUNCTION public.get_unread_counts_by_section()
RETURNS TABLE (
  section text,
  unread_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sections text[];
  v_is_super boolean;
BEGIN
  SELECT public.is_super_admin() INTO v_is_super;
  IF v_is_super THEN
    RETURN QUERY
    SELECT 'orders'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'order' AND user_id = auth.uid()
    UNION ALL
    SELECT 'support'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'support' AND user_id = auth.uid()
    UNION ALL
    SELECT 'service'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'service' AND user_id = auth.uid()
    UNION ALL
    SELECT 'trade_ins'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'trade_in' AND user_id = auth.uid()
    UNION ALL
    SELECT 'sell_phone'::text, COUNT(*)::integer FROM public.notifications
      WHERE is_read = false AND type = 'sell_phone' AND user_id = auth.uid();
  ELSE
    SELECT assigned_sections INTO v_sections FROM public.admins WHERE user_id = auth.uid();
    IF v_sections IS NULL THEN
      v_sections := ARRAY[]::text[];
    END IF;

    IF array_position(v_sections, 'orders') IS NOT NULL THEN
      RETURN QUERY SELECT 'orders'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'order' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'support') IS NOT NULL THEN
      RETURN QUERY SELECT 'support'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'support' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'service') IS NOT NULL THEN
      RETURN QUERY SELECT 'service'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'service' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'trade_ins') IS NOT NULL THEN
      RETURN QUERY SELECT 'trade_ins'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'trade_in' AND user_id = auth.uid();
    END IF;
    IF array_position(v_sections, 'sell_phone') IS NOT NULL THEN
      RETURN QUERY SELECT 'sell_phone'::text, COUNT(*)::integer FROM public.notifications
        WHERE is_read = false AND type = 'sell_phone' AND user_id = auth.uid();
    END IF;
  END IF;
END;
$function$;

-- admins tablosu için RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select" ON admins;
CREATE POLICY "admins_select" ON admins FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "admins_insert" ON admins;
CREATE POLICY "admins_insert" ON admins FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "admins_update" ON admins;
CREATE POLICY "admins_update" ON admins FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "admins_delete" ON admins;
CREATE POLICY "admins_delete" ON admins FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- RPC yetkileri
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_sections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_sections() TO authenticated;

REVOKE ALL ON FUNCTION public.get_staff_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_members() TO authenticated;

REVOKE ALL ON FUNCTION public.add_staff_member(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_staff_member(uuid, text, text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.update_staff_member(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_member(uuid, text, text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_staff_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_staff_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_unread_counts_by_section() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_counts_by_section() TO authenticated;
