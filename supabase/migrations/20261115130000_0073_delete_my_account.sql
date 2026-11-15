/*
# Kullanıcının kendi hesabını silmesi (Apple App Store kuralı 5.1.1(v))

- public.delete_my_account(): oturum açmış kullanıcının hesabını kalıcı olarak siler.
- Kişisel veriler (adresler, favoriler, yorumlar, sohbetler, bildirimler, push token'ları,
  sadakat puanları, stok alarmları, onay kayıtları) silinir.
- Sipariş, satış, servis, telefon satış ve takas kayıtları yasal saklama yükümlülüğü
  (vergi/muhasebe) nedeniyle SİLİNMEZ; yalnızca kullanıcıyla bağlantıları (user_id) kaldırılır.
  orders.user_id auth.users'a ON DELETE CASCADE bağlı olduğu için önce NULL yapılması şart,
  aksi halde siparişler ve bağlı kayıtlar da silinirdi.
- Admin hesapları bu yolla silinemez (panelin sahipsiz kalmaması için).
*/

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Yönetici hesapları uygulama üzerinden silinemez';
  END IF;

  -- Yasal olarak saklanması gereken kayıtlar: bağlantıyı kopar
  UPDATE public.orders              SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.sales               SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.service_records     SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.sell_phone_requests SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.trade_ins           SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.operator_leads      SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.kvkk_requests       SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.audit_logs          SET user_id = NULL WHERE user_id = v_uid;
  UPDATE public.stock_movements     SET user_id = NULL WHERE user_id = v_uid;

  -- auth.users'a FK'si olmayan kişisel veriler: sil
  DELETE FROM public.chat_conversations WHERE user_id = v_uid;
  DELETE FROM public.favorites          WHERE user_id = v_uid;
  DELETE FROM public.loyalty_points     WHERE user_id = v_uid;
  DELETE FROM public.product_reviews    WHERE user_id = v_uid;
  DELETE FROM public.stock_alerts       WHERE user_id = v_uid;

  -- Kalanlar (profil, adresler, bildirimler, push, onay kayıtları) CASCADE ile silinir
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
