/*
# Fix: orders.user_id nullable yap

## Açıklama
POS ve servis satışlarında walk-in müşteri olabilir (kayıtlı kullanıcı yok). 
user_id NOT NULL kısıtı bu durumu engelliyor. Nullable yapıyoruz.

## Değişiklik
- orders.user_id kolonu nullable yapılıyor (DROP NOT NULL)
- Mevcut veri etkilenmez
*/

ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
