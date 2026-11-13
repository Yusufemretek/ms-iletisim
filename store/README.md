# Store Listing Files — MS İletişim

Bu klasör, Google Play Store ve Apple App Store'a uygulama yüklemek için gereken tüm mağaza listeleme dosyalarını içerir.

## Klasör Yapısı

```
store/
├── listings/
│   ├── google-play/          # Google Play Store dosyaları
│   │   ├── title.txt              → Uygulama adı (30 karakter max)
│   │   ├── short_description.txt  → Kısa açıklama (80 karakter max)
│   │   ├── full_description.txt  → Uzun açıklama (4000 karakter max)
│   │   ├── promo_text.txt         → Promosyon metni (170 karakter max)
│   │   ├── release_notes.txt      → Sürüm notları (500 karakter max)
│   │   ├── privacy_policy_url.txt → Gizlilik politikası URL
│   │   ├── support_url.txt        → Destek URL
│   │   ├── marketing_url.txt       → Pazarlama URL
│   │   ├── category.txt           → Kategori (SHOPPING)
│   │   ├── target_audience.txt     → Hedef kitle
│   │   ├── content_rating.txt     → İçerik derecelendirmesi
│   │   └── data_safety.txt        → Veri güvenliği formu cevapları
│   └── app-store/            # Apple App Store dosyaları
│       ├── name.txt               → Uygulama adı (30 karakter max)
│       ├── subtitle.txt            → Alt başlık (30 karakter max)
│       ├── description.txt        → Açıklama (4000 karakter max)
│       ├── promotional_text.txt    → Promosyon metni (170 karakter max)
│       ├── release_notes.txt      → Sürüm notları (4000 karakter max)
│       ├── keywords.txt           → Anahtar kelimeler (100 karakter max)
│       ├── rating.txt             → Yaş derecelendirmesi (4+)
│       ├── primary_language.txt   → Ana dil (tr)
│       ├── support_email.txt      → Destek e-postası
│       ├── support_url.txt        → Destek URL
│       ├── privacy_url.txt        → Gizlilik politikası URL
│       ├── marketing_url.txt      → Pazarlama URL
│       ├── copyright.txt          → Telif hakkı
│       └── privacy_nutrition_label.txt → Apple gizlilik etiketi cevapları
└── fastlane/                # Fastlane otomasyon dosyaları
    ├── Appfile                    → Apple ID, Team ID, Bundle ID
    ├── Fastfile                    → Build & upload lane'leri
    ├── android/
    │   └── metadata/tr-TR/         → Play Store metadata (Fastlane format)
    │       ├── title.txt
    │       ├── short_description.txt
    │       ├── full_description.txt
    │       └── changelogs/1.txt    → versionCode 1 sürüm notları
    └── ios/
        └── metadata/tr-TR/        → App Store metadata (Fastlane format)
            ├── name.txt
            ├── subtitle.txt
            ├── description.txt
            ├── keywords.txt
            ├── promotional_text.txt
            ├── release_notes.txt
            ├── rating.txt
            ├── support_email.txt
            ├── privacy_url.txt
            ├── support_url.txt
            ├── marketing_url.txt
            └── copyright.txt
```

## Ekran Görüntüleri

### Google Play Store
- Minimum: 320px — Maksimum: 3840px
- En az 2, en fazla 8 ekran görüntüsü
- JPEG veya 24-bit PNG (alfa kanalı olmayan)
- Format: 16:9 veya 9:16
- Konum: `store/fastlane/android/metadata/tr-TR/images/` (phoneScreenshots)

### Apple App Store
- 6.7" (iPhone 15 Pro Max): 1290 × 2796 piksel
- 6.5" (iPhone 11 Pro Max): 1242 × 2688 piksel
- 5.5" (iPhone 8 Plus): 1242 × 2208 piksel
- iPad 12.9": 2048 × 2732 piksel
- En az 1 set gerekli, 3 set önerilir
- JPEG veya PNG, renk alanı sRGB
- Konum: `store/fastlane/ios/metadata/tr-TR/screenshots/`

## Uygulama İkonu

### Google Play
- 512 × 512 piksel, 32-bit PNG (alfa kanalı ile)

### Apple App Store
- 1024 × 1024 piksel, PNG (alfa kanalı olmadan)
- Daire köşeli, yuvarlatılmış olmamalı

## Fastlane Kullanımı

### Android (Google Play)
```bash
# Build al
fastlane android build

# Internal Testing'e yükle
fastlane android internal

# Production'a yükle
fastlane android production
```

### iOS (App Store)
```bash
# Build al
fastlane ios build

# TestFlight'a yükle
fastlane ios beta

# App Store'a yükle
fastlane ios release
```

## Önemli Notlar

1. **Fastfile içindeki `team_id` değerini değiştirin** — Apple Developer Team ID'nizi girin
2. **Keystore**: Android release build için `android/keystore.properties` dosyasını oluşturun
3. **Ekran görüntüleri**: Mağaza listelemesi için gerçek cihaz ekran görüntüleri kullanın
4. **Gizlilik politikası**: URL zorunlu — https://msiletisim.com/account/privacy
5. **Sürüm yükseltme**: `android/app/build.gradle` versionCode ve `ios` MARKETING_VERSION değerlerini artırın
6. **AAB format**: Google Play için .aab, App Store için .ipa formatında build alın
