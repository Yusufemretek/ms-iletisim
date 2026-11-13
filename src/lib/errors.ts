// Supabase / tarayıcı kaynaklı İngilizce hata mesajlarını Türkçeye çevirir.
const RULES: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-posta veya şifre hatalı.'],
  [/email not confirmed/i, 'E-posta adresiniz henüz doğrulanmadı. Lütfen gelen kutunuzu kontrol edin.'],
  [/user already registered|already been registered|already exists|been taken/i, 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.'],
  [/password should be at least (\d+)/i, 'Şifre en az $1 karakter olmalıdır.'],
  [/new password should be different/i, 'Yeni şifre eskisinden farklı olmalıdır.'],
  [/password.*(weak|strength)/i, 'Şifre çok zayıf. Harf ve rakam içeren daha güçlü bir şifre seçin.'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'Geçerli bir e-posta adresi girin.'],
  [/(email )?rate limit|too many requests|for security purposes, you can only request/i, 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.'],
  [/token has expired|otp.*expired|link is invalid or has expired/i, 'Bağlantının süresi dolmuş. Lütfen yeniden isteyin.'],
  [/auth session missing|jwt expired|invalid jwt|not authenticated/i, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.'],
  [/signups not allowed|signup is disabled/i, 'Şu anda yeni kayıt alınmıyor.'],
  [/user not found/i, 'Kullanıcı bulunamadı.'],
  [/failed to fetch|network ?error|load failed|networkerror/i, 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.'],
  [/timeout|timed out/i, 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.'],
  [/row-level security|violates row level|permission denied|not authorized|unauthorized/i, 'Bu işlem için yetkiniz yok.'],
  [/duplicate key|unique constraint/i, 'Bu kayıt zaten mevcut.'],
  [/violates foreign key/i, 'Bu kayıt başka kayıtlarla ilişkili olduğu için işlem yapılamadı.'],
  [/violates not-null|null value in column/i, 'Lütfen zorunlu alanları doldurun.'],
  [/violates check constraint/i, 'Girilen değer geçersiz.'],
  [/invalid input syntax/i, 'Girilen değerin formatı hatalı.'],
  [/could not find the .* column|column .* does not exist|schema cache/i, 'Sistem güncellemesi eksik. Lütfen mağaza ile iletişime geçin.'],
  [/payload too large|exceeded the maximum allowed size|entity too large/i, 'Dosya çok büyük.'],
  [/mime type .* not supported|invalid mime/i, 'Bu dosya türü desteklenmiyor.'],
  [/bucket not found/i, 'Dosya deposu bulunamadı. Lütfen mağaza ile iletişime geçin.'],
];

// Türkçe karakter veya tipik Türkçe kelime içeriyorsa mesaj zaten Türkçedir.
const LOOKS_TURKISH = /[çğıöşüÇĞİÖŞÜ]|\b(lutfen|yetersiz|yetkisiz|bulunamadi|zaten|hata|islem|urun|siparis|sepet|teklif|talep)\b/i;

export function trError(err: unknown, fallback = 'Bir sorun oluştu. Lütfen tekrar deneyin.'): string {
  const msg =
    typeof err === 'string' ? err :
    err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message ?? '') :
    '';
  if (!msg) return fallback;
  for (const [re, tr] of RULES) {
    const m = msg.match(re);
    if (m) return tr.replace('$1', m[1] ?? '');
  }
  if (LOOKS_TURKISH.test(msg)) return msg;
  console.warn('Çevrilmemiş hata mesajı:', msg);
  return fallback;
}
