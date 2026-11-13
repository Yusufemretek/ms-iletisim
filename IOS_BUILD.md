# iOS Build — Mac Olmadan (Codemagic)

iOS uygulaması yalnızca macOS + Xcode ile derlenebilir. Mac'imiz olmadığı için derlemeyi
**Codemagic**'in bulut Mac makinelerinde yapıyoruz. İmzalama sertifikası ve provisioning
profile'ı Codemagic, App Store Connect API anahtarıyla **otomatik** oluşturur; IPA'yı da
doğrudan **TestFlight**'a yükler. Hiçbir adımda Mac gerekmez.

## Android'den iOS'a uyarlananlar (v1.0.2)

| Konu | Android | iOS |
|---|---|---|
| Paket adı | `applicationId "msiletisim.com"` | `PRODUCT_BUNDLE_IDENTIFIER = msiletisim.com` |
| Sürüm | versionName 1.0.2 / versionCode 5 | MARKETING_VERSION 1.0.2 / CURRENT_PROJECT_VERSION 5 (CI'da otomatik artar) |
| Eklentiler | `cap sync android` | `cap sync ios` → preferences + push-notifications Package.swift'e eklendi |
| İkon / splash | assets/ klasöründen yeniden üretildi | Aynı kaynaklardan yeniden üretildi (ikon şeffaflıksız 1024px) |
| Açılışta push çökmesi | `VITE_ENABLE_NATIVE_PUSH` ile kapalı | Aynı JS kodu → iOS'ta da kapalı. AppDelegate'e APNs köprüsü eklendi (ileride açmak için) |
| Diğer | — | `ITSAppUsesNonExemptEncryption=false` (her yüklemede şifreleme sorusu sorulmaz), paylaşılan `App` scheme'i |

## Bir kerelik kurulum

### 1. Apple Developer hesabı (99$/yıl)
https://developer.apple.com/programs/ — onay 1-2 gün sürebilir. Kurumsal hesap için D-U-N-S numarası gerekir.

### 2. App ID ve App Store Connect'te uygulama
1. https://developer.apple.com/account/resources/identifiers → **+** → App IDs → App
   - Bundle ID (Explicit): `msiletisim.com`
   - Capabilities: **Push Notifications** işaretleyin (entitlements dosyasında var, yoksa imza hata verir)
2. https://appstoreconnect.apple.com → Uygulamalar → **+** → Yeni Uygulama
   - Platform iOS, Ad: MS İletişim, Birincil dil: Türkçe, Paket Kimliği: `msiletisim.com`, SKU: `msiletisim-ios`

### 3. App Store Connect API anahtarı
App Store Connect → Kullanıcılar ve Erişim → **Entegrasyonlar** → App Store Connect API → **+**
- Ad: Codemagic, Erişim: **App Manager**
- `.p8` dosyasını indirin (**yalnızca bir kez** indirilebilir), **Issuer ID** ve **Key ID**'yi not edin.

### 4. Kodu Git'e koyun
Codemagic projeyi GitHub/GitLab/Bitbucket'tan çeker. Özel (private) repo önerilir.
```bash
cd project
git init && git add . && git commit -m "iOS uyarlaması"
git remote add origin git@github.com:KULLANICI/ms-iletisim.git
git push -u origin main
```
`.gitignore` keystore, `.env`, `.p8` gibi gizli dosyaları zaten dışarıda bırakıyor — push'tan önce
`git status` ile kontrol edin.

### 5. Codemagic
1. https://codemagic.io → GitHub ile giriş → **Add application** → repo'yu seçin → "Capacitor" / codemagic.yaml.
2. **Team settings → Integrations → App Store Connect → Connect**
   - Adı tam olarak: `MS Iletisim ASC Key` (codemagic.yaml'daki isim)
   - Issuer ID, Key ID ve `.p8` dosyasını girin.
3. **Uygulama → Environment variables**, grup adı `supabase`:
   - `VITE_SUPABASE_URL` = .env'deki değer
   - `VITE_SUPABASE_ANON_KEY` = .env'deki değer (Secure işaretleyin)
4. **Code signing identities → iOS certificates → Generate certificate** (Apple Distribution),
   oluşturduktan sonra private key'i indirip saklayın. Profil, build sırasında otomatik alınır.

## Build almak
Codemagic → uygulama → **Start new build** → workflow: `ios-release` → Start.

~15-20 dk sonra IPA TestFlight'a yüklenir. App Store Connect'te:
1. TestFlight sekmesinde build "İşleniyor"dan çıkınca kendi iPhone'unuza TestFlight uygulamasıyla kurup test edin.
2. **Dağıtım** sekmesinde 1.0.2 sürümünü oluşturun → build'i seçin → ekran görüntüleri
   (6.9" iPhone zorunlu, iPad destekleniyorsa 13" iPad), açıklama, gizlilik URL'si, App Privacy formu → **İncelemeye Gönder**.

Ücretsiz plan ayda 500 dakika macOS M2 verir; bu uygulama için ayda ~25 build eder.

## Sonraki sürümler
- Sürüm adını değiştirmek için `ios/App/App.xcodeproj/project.pbxproj` içindeki iki `MARKETING_VERSION`'ı güncelleyin.
- Build numarası her Codemagic build'inde otomatik artar (`BUILD_NUMBER + 5`), elle dokunmayın.

## Sık karşılaşılan hatalar
- **"No matching profiles found for bundle identifier msiletisim.com"** → Adım 2'deki App ID oluşturulmamış veya API anahtarının yetkisi App Manager değil.
- **"Provisioning profile doesn't include the aps-environment entitlement"** → App ID'de Push Notifications capability açın.
- **Uygulama açılıyor ama veri gelmiyor** → Codemagic'te `supabase` grubundaki değişkenler eksik.
- **App Store reddi 4.2 (Minimum Functionality)** → Uygulama yalnızca web sitesini sarmalıyor gibi görünürse reddedilebilir; incelemede native özellikleri (bildirim, haptik, çevrimdışı ekran) vurgulayın ve test hesabı bilgisi verin.

## Alternatifler
- **GitHub Actions macOS runner**: Özel repoda dakika 10x sayılır (ücretsiz 2000 dk → ~200 macOS dk), imzalamayı fastlane match ile kendiniz kurmanız gerekir. Daha zahmetli.
- **Kiralık Mac** (MacinCloud ~25-30$/ay, AWS EC2 Mac): Uzaktan masaüstü ile Xcode'u doğrudan kullanırsınız; simülatörde test için iyi, ama sürekli kullanım pahalı.
- **Ionic Appflow**: Capacitor'ın kendi bulut servisi; çalışır ama ücretli planı yüksektir.

## Push bildirimlerini iOS'ta açmak (ileride)
1. Apple Developer → Keys → **APNs** anahtarı oluşturun (.p8).
2. Firebase'de iOS uygulaması ekleyin (bundle `msiletisim.com`), APNs anahtarını yükleyin.
3. `.env` / Codemagic'e `VITE_ENABLE_NATIVE_PUSH=true` ekleyin.
4. Native token'ı Supabase'e kaydeden geliştirme yapılmalı (Android ile aynı eksik).
