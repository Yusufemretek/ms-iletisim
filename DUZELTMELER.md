# Açılışta Çökme Düzeltmesi (v1.0.2 / versionCode 5 / msiletisim.com)

## Sorunun nedeni
Uygulama açılır açılmaz `PushNotifications.register()` çağrılıyordu. Android'de bu çağrı
Firebase ister. Projede `android/app/google-services.json` dosyası olmadığı için
uygulama "Default FirebaseApp is not initialized" hatasıyla anında kapanıyordu.

Ayrıca `android/` klasörü güncel değildi: push-notifications ve preferences eklentileri
native projeye eklenmemişti (`npx cap sync` çalıştırılmamıştı).

## Yapılan değişiklikler
1. **src/lib/mobile.ts**: Native push artık sadece `VITE_ENABLE_NATIVE_PUSH=true` ise başlatılıyor.
   Açılışta izin isteme kaldırıldı; izin önce kontrol ediliyor, reddedilirse register çağrılmıyor.
2. **src/lib/notifications.ts / push-notifications.ts**: Giriş yapıldığında tetiklenen push kaydı
   da aynı ayara bağlandı (giriş yapınca çökme de engellendi).
3. **android/app/build.gradle**: Paket adı Play Console'a uygun olarak `applicationId "msiletisim.com"`,
   `namespace = "msiletisim.com"` yapıldı. `versionCode 5`, `versionName 1.0.2` olarak ayarlandı
   (Play Console'da 4 ve öncesi zaten kullanılmış).
4. **capacitor.config.ts**: `appId: 'msiletisim.com'` olarak güncellendi.
5. **MainActivity.java**: `msiletisim.com` paket yapısına taşındı.
6. `minifyEnabled`/`shrinkResources` kapatıldı (R8, Capacitor eklentilerini silip çökmeye yol açabiliyor).
4. **capacitor.config.ts**: Capacitor 8'de artık olmayan `bundledWebRuntime` kaldırıldı.
5. `npm run build` + `npx cap sync android` çalıştırıldı; android projesi güncel.

## Yeni sürümü yükleme
```bash
npm install
npm run cap:sync
npx cap open android
# Android Studio: Build > Generate Signed Bundle / APK > Android App Bundle
# İLK YÜKLEMEDE KULLANDIĞINIZ AYNI keystore ile imzalayın.
```
Oluşan `.aab` dosyasını Play Console'da yeni sürüm olarak yükleyin.

## Push bildirimlerini ileride açmak için
1. Firebase Console'da `com.msiletisim.app` paket adıyla Android uygulaması oluşturun.
2. `google-services.json` dosyasını `android/app/` içine koyun.
3. `.env` dosyasına `VITE_ENABLE_NATIVE_PUSH=true` ekleyin.
4. `npm run cap:sync` ve yeniden derleyin.

Not: Native cihaz token'ı şu an Supabase'e kaydedilmiyor (yalnızca web push kaydediliyor);
mobilde bildirim göndermek için FCM token'ını kaydeden ek bir geliştirme gerekir.
