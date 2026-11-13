import { supabase } from '@/lib/supabase';

export async function uploadProductImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `products/${fileName}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
    });

  if (error) {
    console.error('Upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBannerImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `banners/${fileName}`;

  const { error } = await supabase.storage
    .from('promo-banners')
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
    });

  if (error) {
    console.error('Banner upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('promo-banners').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProductImage(url: string): Promise<void> {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/product-images/');
    if (parts.length < 2) return;
    const path = `products/${parts[1]}`;
    await supabase.storage.from('product-images').remove([path]);
  } catch {
    // ignore
  }
}
