/*
# Add new phone specification columns

1. Purpose
   Sıfır telefon ürünlerinde 2. el cihaz değerlendirme alanları (kozmetik, kutu durumu, şarj aleti, pil sağlığı vb.)
   yerine gerçek teknik özellikler (ekran, kamera, batarya, işlemci, işletim sistemi) göstermek için
   products tablosuna yeni kolonlar eklenir.

2. New Columns (products table)
   - screen_size       text  — Ekran boyutu/teknolojisi (örn "6.1 inç OLED")
   - camera_info       text  — Kamera bilgileri (örn "48MP + 12MP")
   - battery_capacity  text  — Batarya kapasitesi (örn "4000 mAh")
   - processor         text  — İşlemci (örn "A16 Bionic")
   - operating_system  text  — İşletim sistemi (örn "iOS 17")

3. Notes
   - Tüm kolonlar nullable — mevcut ürünleri etkilemez.
   - 2. el cihaz alanları (cosmetic_condition, box_condition, charger_condition, battery_health vb.)
     korunur; frontend bunları sadece used_phone türünde gösterir.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'screen_size') THEN
    ALTER TABLE public.products ADD COLUMN screen_size text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'camera_info') THEN
    ALTER TABLE public.products ADD COLUMN camera_info text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'battery_capacity') THEN
    ALTER TABLE public.products ADD COLUMN battery_capacity text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'processor') THEN
    ALTER TABLE public.products ADD COLUMN processor text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'operating_system') THEN
    ALTER TABLE public.products ADD COLUMN operating_system text;
  END IF;
END $$;
