import { supabase } from '@/lib/supabase';

export const PHOTO_BUCKET = 'sell-phone-photos';
const MAX_SIDE = 1600;
const MAX_RAW_BYTES = 15 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

// Telefon kamerasından gelen büyük fotoğrafları küçültüp JPEG'e çevirir.
// Android'de dosya adında uzantı olmaması / boş MIME türü sorunlarını da ortadan kaldırır.
async function toJpeg(file: File): Promise<Blob | null> {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  } catch {
    return null;
  }
}

export interface PhotoUploadResult {
  urls: string[];
  failed: number;
  message: string;
}

export async function uploadDevicePhotos(files: File[], userId: string): Promise<PhotoUploadResult> {
  const urls: string[] = [];
  let failed = 0;
  let tooBig = 0;

  for (const file of files) {
    try {
      let body: Blob | null = await toJpeg(file);
      let ext = 'jpg';
      let contentType = 'image/jpeg';

      if (!body) {
        // Tarayıcı çözemediyse (ör. HEIC) orijinali yükle
        if (file.size > MAX_RAW_BYTES) { tooBig++; continue; }
        body = file;
        const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
        ext = fromName || (file.type.split('/')[1] ?? 'jpg');
        contentType = file.type || 'image/jpeg';
      }

      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, body, { contentType, cacheControl: '3600', upsert: false });
      if (error) {
        console.error('Fotoğraf yükleme hatası:', error.message);
        failed++;
        continue;
      }
      urls.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
    } catch (e) {
      console.error('Fotoğraf yükleme hatası:', e);
      failed++;
    }
  }

  let message = '';
  if (tooBig) message = `${tooBig} fotoğraf çok büyük olduğu için eklenemedi.`;
  if (failed) message = (message ? message + ' ' : '') + `${failed} fotoğraf yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.`;
  return { urls, failed: failed + tooBig, message };
}

export async function removeDevicePhoto(url: string): Promise<void> {
  try {
    const parts = new URL(url).pathname.split(`/${PHOTO_BUCKET}/`);
    if (parts.length >= 2) await supabase.storage.from(PHOTO_BUCKET).remove([decodeURIComponent(parts[1])]);
  } catch { /* yoksay */ }
}
