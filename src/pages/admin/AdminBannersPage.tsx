import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Edit3, X, Image as ImageIcon, ChevronUp, ChevronDown, Megaphone, Upload, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { uploadBannerImage } from '@/lib/storage';

interface PromoBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  button_text: string | null;
  bg_color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const colorPresets = [
  { label: 'Mavi', value: 'from-electric-500 to-electric-700' },
  { label: 'Yeşil', value: 'from-emerald-500 to-emerald-700' },
  { label: 'Turuncu', value: 'from-amber-500 to-amber-700' },
  { label: 'Kırmızı', value: 'from-rose-500 to-rose-700' },
  { label: 'Mor', value: 'from-violet-500 to-violet-700' },
  { label: 'Camgöbeği', value: 'from-cyan-500 to-cyan-700' },
  { label: 'Lacivert', value: 'from-slate-700 to-slate-900' },
];

const emptyForm = {
  title: '',
  subtitle: '',
  image_url: '',
  link_url: '',
  button_text: '',
  bg_color: 'from-electric-500 to-electric-700',
  is_active: true,
  sort_order: 0,
};

export function AdminBannersPage() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBanners = useCallback(async () => {
    const { data } = await supabase
      .from('promo_banners')
      .select('*')
      .order('sort_order', { ascending: true });
    setBanners((data as PromoBanner[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBanners(); }, [loadBanners]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: banners.length });
    setImageInputMode('upload');
    setModalOpen(true);
  };

  const openEdit = (banner: PromoBanner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      link_url: banner.link_url || '',
      button_text: banner.button_text || '',
      bg_color: banner.bg_color || 'from-electric-500 to-electric-700',
      is_active: banner.is_active,
      sort_order: banner.sort_order,
    });
    setImageInputMode(banner.image_url ? 'url' : 'upload');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      image_url: form.image_url.trim() || null,
      link_url: form.link_url.trim() || null,
      button_text: form.button_text.trim() || null,
      bg_color: form.bg_color,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    if (editingId) {
      await supabase.from('promo_banners').update(payload).eq('id', editingId);
    } else {
      await supabase.from('promo_banners').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    loadBanners();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu bannerı silmek istediğinize emin misiniz?')) return;
    await supabase.from('promo_banners').delete().eq('id', id);
    loadBanners();
  };

  const toggleActive = async (banner: PromoBanner) => {
    await supabase.from('promo_banners').update({ is_active: !banner.is_active }).eq('id', banner.id);
    loadBanners();
  };

  const moveOrder = async (banner: PromoBanner, direction: -1 | 1) => {
    const sorted = [...banners].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(b => b.id === banner.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapBanner = sorted[swapIdx];
    await Promise.all([
      supabase.from('promo_banners').update({ sort_order: swapBanner.sort_order }).eq('id', banner.id),
      supabase.from('promo_banners').update({ sort_order: banner.sort_order }).eq('id', swapBanner.id),
    ]);
    loadBanners();
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    const url = await uploadBannerImage(file);
    if (url) {
      setForm(prev => ({ ...prev, image_url: url }));
    }
    setUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleUploadImage(file);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Promosyon Bannerları</h1>
          <p className="mt-1 text-sm text-slate-500">Ana sayfada görünen kampanya bannerlarını yönetin</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Yeni Banner
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
        </div>
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
            <Megaphone className="h-8 w-8 text-slate-400" />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-600">Henüz banner yok</p>
          <p className="mt-1 text-sm text-slate-500">Ana sayfada görünecek kampanya bannerı ekleyin</p>
          <Button onClick={openCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> İlk Bannerı Ekle
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {[...banners].sort((a, b) => a.sort_order - b.sort_order).map((banner, idx, arr) => (
            <div
              key={banner.id}
              className={`overflow-hidden rounded-2xl border bg-white ${banner.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}
            >
              <div className={`flex flex-col sm:flex-row`}>
                {/* Preview */}
                <div className={`relative flex min-h-[100px] items-center bg-gradient-to-r ${banner.bg_color || 'from-electric-500 to-electric-700'} p-4 sm:w-72 shrink-0`}>
                  {banner.image_url && (
                    <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
                  )}
                  <div className="relative z-10">
                    <p className="text-sm font-bold text-white sm:text-base">{banner.title}</p>
                    {banner.subtitle && <p className="mt-1 text-xs text-white/80 line-clamp-2">{banner.subtitle}</p>}
                    {banner.button_text && (
                      <span className="mt-2 inline-block rounded-lg bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
                        {banner.button_text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info & Actions */}
                <div className="flex flex-1 flex-col justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{banner.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${banner.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {banner.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    {banner.link_url && <p className="mt-1 text-xs text-slate-400">Link: {banner.link_url}</p>}
                    <p className="mt-1 text-xs text-slate-400">Sıra: {banner.sort_order}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => moveOrder(banner, -1)} disabled={idx === 0} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30" title="Yukarı">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button onClick={() => moveOrder(banner, 1)} disabled={idx === arr.length - 1} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30" title="Aşağı">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleActive(banner)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-electric-600 hover:bg-electric-50">
                      {banner.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                    </button>
                    <button onClick={() => openEdit(banner)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-electric-600" title="Düzenle">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(banner.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Sil">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Banner Düzenle' : 'Yeni Banner'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Başlık *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Örn: Yeni Sezon Telefonları"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-electric-400 focus:ring-2 focus:ring-electric-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Alt Başlık</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={e => setForm({ ...form, subtitle: e.target.value })}
              placeholder="Örn: Tüm telefonlarda %15 indirim"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-electric-400 focus:ring-2 focus:ring-electric-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Buton Yazısı</label>
            <input
              type="text"
              value={form.button_text}
              onChange={e => setForm({ ...form, button_text: e.target.value })}
              placeholder="Örn: Hemen İncele"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-electric-400 focus:ring-2 focus:ring-electric-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Tıklanınca Gidilecek Link</label>
            <input
              type="text"
              value={form.link_url}
              onChange={e => setForm({ ...form, link_url: e.target.value })}
              placeholder="Örn: /telefonlar veya https://..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-electric-400 focus:ring-2 focus:ring-electric-100"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-600">Banner Görseli</label>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setImageInputMode('upload')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${imageInputMode === 'upload' ? 'bg-white text-electric-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <Upload className="h-3 w-3" /> Yükle
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('url')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${imageInputMode === 'url' ? 'bg-white text-electric-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <Link2 className="h-3 w-3" /> URL
                </button>
              </div>
            </div>

            {imageInputMode === 'upload' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${uploading ? 'border-electric-300 bg-electric-50' : 'border-slate-200 hover:border-electric-300 hover:bg-slate-50'}`}
                >
                  {uploading ? (
                    <>
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-electric-200 border-t-electric-500" />
                      <p className="mt-2 text-sm text-electric-600">Görsel yükleniyor...</p>
                    </>
                  ) : form.image_url ? (
                    <>
                      <img src={form.image_url} alt="Banner görseli" className="max-h-32 rounded-lg object-contain" />
                      <p className="mt-2 text-xs text-slate-500">Değiştirmek için tıkla veya sürükle bırak</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-400" />
                      <p className="mt-2 text-sm text-slate-500">Görsel yüklemek için tıkla</p>
                      <p className="mt-0.5 text-xs text-slate-400">veya buraya sürükle bırak</p>
                    </>
                  )}
                </div>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image_url: '' })}
                    className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                  >
                    <X className="h-3 w-3" /> Görseli kaldır
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-electric-400 focus:ring-2 focus:ring-electric-100"
                />
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Arka Plan Rengi</label>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm({ ...form, bg_color: c.value })}
                  className={`h-10 w-10 rounded-xl bg-gradient-to-r ${c.value} transition-all ${form.bg_color === c.value ? 'ring-2 ring-offset-2 ring-electric-500 scale-110' : 'hover:scale-105'}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-electric-500 focus:ring-electric-400"
              />
              Aktif olarak göster
            </label>
          </div>

          {/* Preview */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Önizleme</label>
            <div className={`relative flex min-h-[120px] items-center overflow-hidden rounded-xl bg-gradient-to-r ${form.bg_color} p-5`}>
              {form.image_url && (
                <img src={form.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
              )}
              <div className="relative z-10">
                <p className="text-lg font-bold text-white">{form.title || 'Banner Başlığı'}</p>
                {form.subtitle && <p className="mt-1 text-sm text-white/80">{form.subtitle}</p>}
                {form.button_text && (
                  <span className="mt-3 inline-block rounded-lg bg-white/90 px-4 py-1.5 text-sm font-semibold text-slate-800">
                    {form.button_text}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.title.trim()}>
              {editingId ? 'Güncelle' : 'Ekle'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
