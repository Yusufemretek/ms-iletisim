/*
# Fix: orders.customer_email nullable yap

## Açıklama
POS ve servis satışlarında walk-in müşterinin email adresi olmayabilir.
customer_email NOT NULL kısıtı bu durumu engelliyor.

## Değişiklik
- orders.customer_email kolonu nullable yapılıyor
*/

ALTER TABLE public.orders ALTER COLUMN customer_email DROP NOT NULL;
