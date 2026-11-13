# MS İletişim — Uygulama Yayınlama Rehberi

Bu doküman, MS İletişim uygulamasını hem **web** hem de **mobil** (Android/iOS) platformlarda yayınlamak için gereken adımları açıklar.

---

## 1. Web Yayınlama (Bolt Hosting)

En kolay yöntem, Bolt'un dahili hosting özelliğini kullanmaktır:

1. Sağ üstteki **Publish** butonuna tıklayın.
2. İkinci **Publish** butonuna tıklayın.
3. Yaklaşık 1 dakika içinde site yayına alınır.
4. Chat penceresindeki linki tıklayarak sitenizi açın.

### Manuel Web Yayınlama (Netlify)

1. `npm run build` çalıştırın.
2. **Download** ile projeyi indirin.
3. Netlify'ın [manuel deploy](https://docs.netlify.com/site-deploys/create-deploys/#drag-and-drop) talimatlarını izleyin.

> `public/_redirects` dosyası SPA yönlendirmesi için otomatik olarak eklenmiştir.

---

## 2. Android Uygulama Yayınlama (Google Play Store)

### Gereksinimler
- **Android Studio**: https://developer.android.com/studio
- **Google Play Developer hesabı**: 25$ tek seferlik
- Java 17+ (Android Studio ile birlikte gelir)

### Keystore Oluşturma (İmzalama)

Uygulamayı Play Store'a yüklemek için bir release keystore oluşturmanız gerekir:

```bash
keytool -genkey -v -keystore ms-iletisim-release.keystore -alias ms_iletisim -keyalg RSA -keysize 2048 -validity 10000
```

Şifreleri güvenli bir yerde saklayın. Bu keystore dosyasını kaybederseniz uygulamayı güncelleyemezsiniz.

### Signing Yapılandırması

`android/keystore.properties.example` dosyasını `keystore.properties` olarak kopyalayın ve kendi değerlerinizi girin:

```bash
cp android/keystore.properties.example android/keystore.properties
```

Alternatif olarak, gradle özelliklerini `~/.gradle/gradle.properties` içinde tanımlayabilirsiniz:

```properties
MSI_RELEASE_STORE_FILE=/path/to/ms-iletisim-release.keystore
MSI_RELEASE_STORE_PASSWORD=your_store_password
MSI_RELEASE_KEY_ALIAS=ms_iletisim
MSI_RELEASE_KEY_PASSWORD=your_key_password
```

### Production Build Alma

```bash
# Web build + native sync + production build
npm run cap:build:android

# Veya Android Studio'da:
npm run cap:open:android
# Android Studio'da: Build > Generate Signed Bundle/APK
# AAB (Android App Bundle) formatı seçin (Play Store için önerilir)
```

### Play Store'a Yükleme

1. [Google Play Console](https://play.google.com/console)'a giriş yapın.
2. **Uygulama Oluştur**'a tıklayın.
3. Uygulama bilgilerini doldurun.
4. **Production** > **Create Release**'e gidin.
5. AAB dosyanızı yükleyin.
6. Store listing, ekran görüntüleri ve gizlilik politikası bilgilerini doldurun.
7. İncelemeye gönderin (genelde 1-3 gün sürer).

### Önemli Android Bilgileri
- **appId**: `msiletisim.com`
- **Uygulama adı**: "MS İletişim"
- **versionCode**: 1, **versionName**: 1.0.0
- **minSdk**: 24 (Android 7.0+)
- **targetSdk**: 36
- Production build'lerde `minifyEnabled` ve `shrinkResources` aktiftir (daha küçük APK/AAB)
- **İzinler**: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS (Android 13+), VIBRATE
- **allowBackup**: false (güvenlik için)
- **ProGuard**: Supabase, OkHttp, Capacitor sınıfları koruma altında

---

## 3. iOS Uygulama Yayınlama (Apple App Store)

### Gereksinimler
- **Mac bilgisayar** (zorunlu)
- **Xcode**: Mac App Store'dan (ücretsiz)
- **Apple Developer hesabı**: 99$/yıl

### Build Alma

```bash
# Web build + native sync + production build
npm run cap:build:ios

# Veya Xcode'da:
npm run cap:open:ios
# Xcode'da:
#   - Signing & Capabilities > Team seçin
#   - Bundle Identifier: msiletisim.com
#   - Push Notifications capability eklendi (otomatik)
#   - Product > Archive
```

### App Store Connect'e Yükleme

1. [App Store Connect](https://appstoreconnect.apple.com)'e giriş yapın.
2. **My Apps** > **+** > **New App**'e tıklayın.
3. Uygulama bilgilerini doldurun (isim, dil, bundle ID).
4. Xcode'da Archive aldıktan sonra **Distribute App** > **App Store Connect**.
5. Ekran görüntüleri, açıklama ve gizlilik politikası ekleyin.
6. İncelemeye gönderin (genelde 1-7 gün sürer).

### Önemli iOS Bilgileri
- **Bundle Identifier**: `msiletisim.com`
- **MARKETING_VERSION**: 1.0.0
- **Deployment Target**: iOS 15.0+
- **Desteklenen cihazlar**: iPhone ve iPad
- **Entitlements**:
  - Debug: `App.entitlements` (aps-environment: development)
  - Release: `AppRelease.entitlements` (aps-environment: production)
- **Background Modes**: remote-notification (push bildirimler için)
- **Kamera ve Fotoğraf izinleri**: Info.plist içinde tanımlı (Türkçe)
- **ITSAppUsesNonExemptEncryption**: false (şifreleme muafiyeti)

---

## 4. PWA (Progressive Web App)

Uygulama PWA özellikleri içerir:
- `public/manifest.json` — yüklenebilir web uygulaması tanımı (id: msiletisim.com)
- `public/logo.png` — uygulama simgesi
- `public/splash.png` — açılış ekranı
- Offline çalışma için service worker eklenebilir (ileride)

Kullanıcılar tarayıcıdan "Ana Ekrana Ekle" ile uygulamayı yükleyebilir.

---

## 5. Sık Kullanılan Komutlar

```bash
npm run build              # Web production build
npm run cap:sync           # Web build + native sync
npm run cap:build:android  # Android production build
npm run cap:build:ios      # iOS production build (Mac gerekir)
npm run cap:open:android   # Android Studio'da aç
npm run cap:open:ios       # Xcode'da aç
npm run cap:run:android    # Android cihazda çalıştır
npm run cap:run:ios        # iOS cihazda çalıştır (Mac gerekir)
```

---

## 6. Yayınlama Öncesi Kontrol Listesi

### Genel
- [ ] `npm run build` başarıyla tamamlanıyor
- [ ] TypeScript hatası yok (`npm run typecheck`)
- [ ] Supabase migration'lar uygulandı
- [ ] Uygulama simgesi ve açılış ekranı doğru
- [ ] Web'de test edildi (farklı ekran boyutları)
- [ ] Gizlilik politikası sayfası hazır
- [ ] KVKK aydınlatma metni hazır

### Android (Play Store)
- [ ] Android'de test edildi (Capacitor)
- [ ] Release keystore oluşturuldu
- [ ] `keystore.properties` dolduruldu
- [ ] AAB (App Bundle) build alındı
- [ ] Play Console'da uygulama oluşturuldu
- [ ] Store listing dolduruldu (başlık, açıklama, kategori)
- [ ] Ekran görüntüleri eklendi (telefon + tablet)
- [ ] Gizlilik politikası URL'si eklendi
- [ ] Content rating anketi dolduruldu
- [ ] Hedef kitle ve içerik bölümü dolduruldu
- [ ] Data safety formu dolduruldu

### iOS (App Store)
- [ ] iOS'ta test edildi (Mac varsa)
- [ ] Apple Developer Team seçili
- [ ] Push Notifications capability eklendi (otomatik)
- [ ] App.entitlements (Debug) ve AppRelease.entitlements (Release) doğru
- [ ] Archive alındı
- [ ] App Store Connect'te uygulama oluşturuldu
- [ ] Ekran görüntüleri eklendi (6.7" + 5.5" + iPad)
- [ ] Açıklama ve anahtar kelimeler dolduruldu
- [ ] Gizlilik politikası URL'si eklendi
- [ ] App Privacy (veri kullanımı) formu dolduruldu
- [ ] Age rating belirlendi

### Supabase / Backend
- [ ] Push notification edge function deploy edildi
- [ ] Push notification trigger'lar aktif
- [ ] RLS politikaları kontrol edildi
- [ ] Production URL'ler doğru

---

## 7. Store Listing Bilgileri (Önerilen)

### Türkçe
- **Uygulama Adı**: MS İletişim
- **Kısa Açıklama**: Telefon, aksesuar, servis, operatör kampanyaları ve 2. el alım-satım
- **Açıklama**: MS İletişim ile telefon, aksesuar, tablet ve akıllı saat satın alın; teknik servis talebinde bulunun; operatör kampanyalarından faydalanın; 2. el cihazlarınızı satın veya takas edin. Tüm bu hizmetleri tek bir uygulamadan kolayca yönetin.
- **Kategori**: Alışveriş (Shopping)
- **İçerik Derecelendirmesi**: 4+ (iOS) / Herkes (Android)

### Gizlilik Politikası URL
- Web sitenizdeki gizlilik politikası sayfasının URL'sini kullanın (örn: https://msiletisim.com/gizlilik)

---

## 8. Sık Karşılaşılan Sorunlar

### Android
- **"google-services.json not found"**: Push bildirimler için Firebase projesi oluşturun ve `google-services.json` dosyasını `android/app/` klasörüne koyun.
- **Signing hatası**: `keystore.properties` dosyasının yolunu ve şifreleri kontrol edin.
- **"minifyEnabled" hatası**: ProGuard kuralları `proguard-rules.pro` içinde tanımlı, ek kural gerekmez.

### iOS
- **"No profiles for 'msiletisim.com' were found"**: Xcode'da Signing & Capabilities bölümünden Team seçin.
- **Push bildirim çalışmıyor**: App.entitlements (Debug) ve AppRelease.entitlements (Release) dosyalarının doğru olduğundan emin olun.
- **App Store reddi**: Gizlilik politikası URL'si ve veri kullanımı formunu doldurun.
