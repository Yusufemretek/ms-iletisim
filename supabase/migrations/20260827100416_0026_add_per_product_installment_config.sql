/*
# Add per-product installment configuration

1. Purpose
   Ürün bazında taksit ayarları yapabilmek için products tablosuna installment_config kolonu eklenir.
   Mağaza sahibi stok girişi yaparken her ürün için hangi taksit sayılarının geçerli olduğunu,
   her taksit için faiz oranı ve komisyon oranı belirleyebilir.

2. New Column (products table)
   - installment_config jsonb — Örnek: {"3":{"interest_rate":0,"commission_rate":0.02},...}
   NULL = global installment_settings kullanılır.

3. RPC Update
   get_installment_options güncellenir: ürünün installment_config'i varsa onu kullanır.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'installment_config') THEN
    ALTER TABLE public.products ADD COLUMN installment_config jsonb;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_installment_options(uuid);

CREATE FUNCTION public.get_installment_options(p_product_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'installment_count', i.installment_count,
    'label', i.label,
    'interest_rate', COALESCE(
      CASE WHEN p.installment_config ? i.installment_count::text
           THEN (p.installment_config -> i.installment_count::text ->> 'interest_rate')::numeric
           ELSE NULL END,
      i.interest_rate
    ),
    'commission_rate', COALESCE(
      CASE WHEN p.installment_config ? i.installment_count::text
           THEN (p.installment_config -> i.installment_count::text ->> 'commission_rate')::numeric
           ELSE NULL END,
      i.commission_rate
    ),
    'is_active', i.is_active
  ) ORDER BY i.sort_order), '[]'::jsonb)::json
  FROM public.installment_settings i
  LEFT JOIN public.products p ON p.id = p_product_id
  WHERE i.is_active = true
  AND (
    p_product_id IS NULL
    OR p.allowed_installments IS NULL
    OR i.installment_count = ANY(p.allowed_installments)
  )
  AND (
    p.installment_config IS NULL
    OR (p.installment_config ? i.installment_count::text)
  );
$$;
