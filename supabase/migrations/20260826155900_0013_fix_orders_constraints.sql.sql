/*
# Fix: orders payment_method ve status constraint'lerini güncelle

## Açıklama
Mevcut constraint sadece cash_on_delivery ve card_on_delivery izin veriyordu.
Yeni sistem nakit, kart, havale, online kart ve mixed ödemeleri destekliyor.
Ayrıca status için yeni durumlar eklendi (partial payment).

## Değişiklikler
- payment_method check constraint genişletildi
- payment_status check constraint genişletildi (partial eklendi)
- status check constraint genişletildi
*/

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IN ('cash_on_delivery', 'card_on_delivery', 'cash', 'card', 'bank_transfer', 'havale', 'online_card', 'mixed'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'partial', 'paid'));

-- Status constraint varsa kontrol et
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('new', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
