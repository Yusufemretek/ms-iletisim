import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Package, ImagePlus, X, ImageOff, CreditCard, MemoryStick, Minus, Power, PowerOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, COSMETIC_OPTIONS, STATUS_YES_NO } from '@/lib/format';
import { uploadProductImage, deleteProductImage } from '@/lib/storage';
import type { Product, ProductImage, Category, ProductType, ProductVariant } from '@/lib/types';
import { getProductTypeLabel, getProductTypeBadgeVariant } from '@/lib/product-types';
import { trError } from '@/lib/errors';

interface VariantRow {
  id: string | null;
  storage: string;
  price: string;
  stock: string;
  sku: string;
  is_active: boolean;
}

const EMPTY_VARIANT: VariantRow = { id: null, storage: '', price: '', stock: '', sku: '', is_active: true };

export function AdminProductsPage() {
  const [products, setProducts] = useState<(Product & { product_images?: ProductImage[]; product_variants?: ProductVariant[]; category?: Category | null })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const emptyForm = {
    name: '', brand: '', model: '', description: '', cost_price: 0, sale_price: 0, stock: 1,
    type: '' as ProductType | '', category_id: '', is_active: true, pickup_only: false,
    memory: '', ram: '', color: '', imei: '', battery_health: '', cosmetic_condition: '',
    screen_condition: '', face_id: '', touch_id: '', true_tone: '', camera_condition: '',
    speaker_condition: '', microphone_condition: '', warranty_status: '', warranty_end_date: '',
    box_condition: '', charger_condition: '',
    screen_size: '', camera_info: '', battery_capacity: '', processor: '', operating_system: '',
    installment_enabled: { '3': false, '6': false, '9': false, '12': false } as Record<string, boolean>,
    installment_interest: { '3': '0', '6': '5', '9': '8', '12': '12' } as Record<string, string>,
    installment_commission: { '3': '2', '6': '3', '9': '4', '12': '5' } as Record<string, string>,
  };
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*, product_images(*), product_variants(*), category:categories(*)')
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  };

  const TYPE_CATEGORY_MAP: Record<string, string[]> = {
    new_phone: ['Sıfır Telefon'],
    used_phone: ['2. El Telefon'],
    accessory: ['Kulaklık', 'Powerbank', 'Şarj Aleti', 'Kılıf', 'Ekran Koruyucu', 'Diğer Aksesuarlar'],
    tablet: ['Sıfır Telefon'],
    smartwatch: ['Sıfır Telefon'],
  };

  const filteredCategories = form.type
    ? categories.filter(c => (TYPE_CATEGORY_MAP[form.type as string] || []).includes(c.name))
    : categories;

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.model?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    const matchesCategory = filterCategory === 'all' || p.category_id === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setImages([]);
    setVariants([]);
    setError('');
    setShowModal(true);
  };

  const openEdit = (product: Product & { product_images?: ProductImage[]; product_variants?: ProductVariant[] }) => {
    setEditing(product);
    setForm({
      name: product.name, brand: product.brand || '', model: product.model || '',
      description: product.description || '', cost_price: product.cost_price, sale_price: product.sale_price,
      stock: product.stock, type: product.type, category_id: product.category_id || '', is_active: product.is_active, pickup_only: product.pickup_only ?? false,
      memory: product.memory || '', ram: product.ram || '', color: product.color || '', imei: product.imei || '',
      battery_health: product.battery_health || '', cosmetic_condition: product.cosmetic_condition || '',
      screen_condition: product.screen_condition || '', face_id: product.face_id || '', touch_id: product.touch_id || '',
      true_tone: product.true_tone || '', camera_condition: product.camera_condition || '',
      speaker_condition: product.speaker_condition || '', microphone_condition: product.microphone_condition || '',
      warranty_status: product.warranty_status || '', warranty_end_date: product.warranty_end_date || '',
      box_condition: product.box_condition || '', charger_condition: product.charger_condition || '',
      screen_size: product.screen_size || '', camera_info: product.camera_info || '',
      battery_capacity: product.battery_capacity || '', processor: product.processor || '',
      operating_system: product.operating_system || '',
      installment_enabled: (() => {
        const cfg = product.installment_config || {};
        const result: Record<string, boolean> = { '3': false, '6': false, '9': false, '12': false };
        for (const k of Object.keys(cfg)) result[k] = true;
        return result;
      })(),
      installment_interest: (() => {
        const cfg = product.installment_config || {};
        const result: Record<string, string> = { '3': '0', '6': '5', '9': '8', '12': '12' };
        for (const k of Object.keys(cfg)) result[k] = String((cfg[k].interest_rate ?? 0) * 100);
        return result;
      })(),
      installment_commission: (() => {
        const cfg = product.installment_config || {};
        const result: Record<string, string> = { '3': '2', '6': '3', '9': '4', '12': '5' };
        for (const k of Object.keys(cfg)) result[k] = String((cfg[k].commission_rate ?? 0) * 100);
        return result;
      })(),
    });
    setImages(product.product_images || []);
    setVariants(
      (product.product_variants || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({
          id: v.id,
          storage: v.storage,
          price: String(v.price),
          stock: String(v.stock),
          sku: v.sku || '',
          is_active: v.is_active,
        })),
    );
    setError('');
    setShowModal(true);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const url = await uploadProductImage(file);
      if (url) {
        setImages((prev) => [...prev, {
          id: `temp-${Date.now()}-${Math.random()}`,
          product_id: editing?.id || '',
          image_url: url,
          is_primary: prev.length === 0,
          position: prev.length,
          created_at: new Date().toISOString(),
        }]);
      }
    }
    setUploading(false);
    e.target.value = '';
  };

  const setPrimaryImage = (idx: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === idx })));
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const removed = prev[idx];
      if (removed.image_url.startsWith('http')) deleteProductImage(removed.image_url);
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((i) => i.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { ...EMPTY_VARIANT }]);
  };

  const updateVariant = (idx: number, field: keyof VariantRow, value: string | boolean) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  };

  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Ürün adı zorunludur.'); return; }
    if (!form.type) { setError('Lütfen ürün türünü seçiniz.'); return; }
    if (!form.category_id) { setError('Lütfen kategori seçiniz.'); return; }
    if (form.sale_price < 0 || form.cost_price < 0) { setError('Negatif fiyat girilemez.'); return; }
    if (form.stock < 0) { setError('Negatif stok girilemez.'); return; }

    // Validate variants
    const validVariants = variants.filter((v) => v.storage.trim());
    for (const v of validVariants) {
      if (Number(v.price) < 0) { setError('Varyant fiyatı negatif olamaz.'); return; }
      if (Number(v.stock) < 0) { setError('Varyant stoğu negatif olamaz.'); return; }
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      description: form.description.trim() || null,
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      stock: Number(form.stock) || 0,
      type: form.type,
      is_active: form.is_active,
      pickup_only: form.pickup_only,
      category_id: form.category_id || null,
      memory: form.memory || null,
      ram: form.ram || null,
      color: form.color || null,
      imei: form.imei || null,
      battery_health: form.battery_health || null,
      cosmetic_condition: form.cosmetic_condition || null,
      screen_condition: form.screen_condition || null,
      face_id: form.face_id || null,
      touch_id: form.touch_id || null,
      true_tone: form.true_tone || null,
      camera_condition: form.camera_condition || null,
      speaker_condition: form.speaker_condition || null,
      microphone_condition: form.microphone_condition || null,
      warranty_status: form.warranty_status || null,
      warranty_end_date: form.warranty_end_date || null,
      box_condition: form.box_condition || null,
      charger_condition: form.charger_condition || null,
      screen_size: form.screen_size || null,
      camera_info: form.camera_info || null,
      battery_capacity: form.battery_capacity || null,
      processor: form.processor || null,
      operating_system: form.operating_system || null,
      installment_config: (() => {
        const cfg: Record<string, { interest_rate: number; commission_rate: number }> = {};
        for (const count of ['3', '6', '9', '12']) {
          if (form.installment_enabled[count]) {
            cfg[count] = {
              interest_rate: Number(form.installment_interest[count] || 0) / 100,
              commission_rate: Number(form.installment_commission[count] || 0) / 100,
            };
          }
        }
        return Object.keys(cfg).length > 0 ? cfg : null;
      })(),
    };

    if (editing) {
      payload.id = editing.id;
    }

    const { data: productId, error: err } = await supabase.rpc('upsert_product', { p_data: payload });

    if (err) {
      setError('Kaydetme hatası: ' + trError(err));
      setSaving(false);
      return;
    }

    const newProductId = productId as string;

    if (editing) {
      const { error: delImgErr } = await supabase.from('product_images').delete().eq('product_id', editing.id);
      if (delImgErr) { setError('Fotoğraf silme hatası: ' + trError(delImgErr)); setSaving(false); return; }
    }

    if (newProductId && images.length > 0) {
      const imgPayloads = images.map((img, idx) => ({
        product_id: newProductId,
        image_url: img.image_url,
        is_primary: idx === 0 ? true : img.is_primary,
        position: idx,
      }));
      const { error: imgErr } = await supabase.from('product_images').insert(imgPayloads);
      if (imgErr) { setError('Ürün kaydedildi ama fotoğraflar eklenemedi: ' + trError(imgErr)); setSaving(false); return; }
    }

    // Save variants
    if (newProductId) {
      // Delete existing variants for this product
      if (editing) {
        await supabase.from('product_variants').delete().eq('product_id', newProductId);
      }
      // Insert new variants
      if (validVariants.length > 0) {
        const variantPayloads = validVariants.map((v, idx) => ({
          product_id: newProductId,
          storage: v.storage.trim(),
          price: Number(v.price) || 0,
          stock: Number(v.stock) || 0,
          sku: v.sku.trim() || null,
          is_active: v.is_active,
          sort_order: idx,
        }));
        const { error: variantErr } = await supabase.from('product_variants').insert(variantPayloads);
        if (variantErr) { setError('Ürün kaydedildi ama varyantlar eklenemedi: ' + trError(variantErr)); setSaving(false); return; }
      }
    }

    setSaving(false);
    setShowModal(false);
    loadProducts();
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`"${product.name}" ürününü silmek istediğinize emin misiniz?`)) return;
    await supabase.from('products').delete().eq('id', product.id);
    loadProducts();
  };

  const toggleActive = async (product: Product) => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    loadProducts();
  };

  const quickStockDecrease = async (product: Product) => {
    if (product.stock <= 0) return;
    const newStock = product.stock - 1;
    await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
    loadProducts();
  };

  const canHaveVariants = form.type === 'new_phone' || form.type === 'used_phone' || form.type === 'tablet' || form.type === 'smartwatch';

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ürünler</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} ürün</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Yeni Ürün
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Ürün ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setFilterCategory('all'); }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="all">Tüm Türler</option>
          <option value="new_phone">Sıfır Telefon</option>
          <option value="used_phone">2. El Telefon</option>
          <option value="accessory">Aksesuar</option>
          <option value="tablet">Tablet</option>
          <option value="smartwatch">Akıllı Saat</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="all">Tüm Kategoriler</option>
          {categories
            .filter(c => filterType === 'all' || (TYPE_CATEGORY_MAP[filterType] || []).includes(c.name))
            .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz ürün yok.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Ürün</th>
                <th className="p-3 font-medium">Tür</th>
                <th className="p-3 font-medium">Kategori</th>
                <th className="p-3 font-medium">Fiyat</th>
                <th className="p-3 font-medium">Stok</th>
                <th className="p-3 font-medium">Varyant</th>
                <th className="p-3 font-medium">Durum</th>
                <th className="p-3 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {product.product_images?.[0] ? (
                          <img src={product.product_images[0].image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <ImageOff className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-400">{product.brand} {product.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={getProductTypeBadgeVariant(product.type)}>
                      {getProductTypeLabel(product.type)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-slate-500">{product.category?.name || '—'}</span>
                  </td>
                  <td className="p-3 font-medium text-slate-900">{formatPrice(product.sale_price)}</td>
                  <td className="p-3">
                    <span className={product.stock === 0 ? 'text-red-600' : 'text-slate-600'}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="p-3">
                    {product.product_variants && product.product_variants.length > 0 ? (
                      <Badge variant="info">{product.product_variants.length} varyant</Badge>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(product)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${product.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                    >
                      {product.is_active ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                      {product.is_active ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => quickStockDecrease(product)}
                        disabled={product.stock <= 0}
                        title="Elden satıldı - stok düşür"
                        className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Minus className="h-3.5 w-3.5" />
                        Elden Sat
                      </button>
                      <button onClick={() => openEdit(product)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(product)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Ürünü Düzenle' : 'Yeni Ürün'} size="xl">
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Ürün Türü *</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'new_phone', category_id: categories.find(c => c.name === 'Sıfır Telefon')?.id || '' })}
                className={`rounded-xl border p-3 text-sm font-medium ${form.type === 'new_phone' ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
              >
                Sıfır Telefon
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'used_phone', category_id: categories.find(c => c.name === '2. El Telefon')?.id || '' })}
                className={`rounded-xl border p-3 text-sm font-medium ${form.type === 'used_phone' ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
              >
                2. El Telefon
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'accessory' })}
                className={`rounded-xl border p-3 text-sm font-medium ${form.type === 'accessory' ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
              >
                Aksesuar
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'tablet', category_id: categories.find(c => c.name === 'Sıfır Telefon')?.id || '' })}
                className={`rounded-xl border p-3 text-sm font-medium ${form.type === 'tablet' ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
              >
                Tablet
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'smartwatch', category_id: categories.find(c => c.name === 'Sıfır Telefon')?.id || '' })}
                className={`rounded-xl border p-3 text-sm font-medium ${form.type === 'smartwatch' ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
              >
                Akıllı Saat
              </button>
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Ürün Fotoğrafları</label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  {img.is_primary && (
                    <span className="absolute left-1 top-1 rounded bg-amber-500 px-1 text-[10px] font-bold text-white">Ana</span>
                  )}
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 text-slate-600 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {!img.is_primary && (
                    <button
                      onClick={() => setPrimaryImage(idx)}
                      className="absolute bottom-1 left-1 right-1 rounded bg-slate-900/70 py-0.5 text-[10px] font-medium text-white"
                    >
                      Ana Yap
                    </button>
                  )}
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600">
                {uploading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                ) : (
                  <ImagePlus className="h-6 w-6" />
                )}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadImage} disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Ürün Adı *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select label="Kategori" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Kategori Seçin</option>
              {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Marka" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input label="Alış Fiyatı (₺)" type="number" min={0} value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} />
            <Input label="Satış Fiyatı (₺)" type="number" min={0} value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} />
            <Input label="Stok" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
            <Select label="Durum" value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={form.pickup_only}
              onChange={(e) => setForm({ ...form, pickup_only: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-electric-600 focus:ring-electric-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Sadece Dükkandan Al</span>
              <p className="text-xs text-slate-400">İşaretliyse bu üründe kurye teslimatı yapılmaz, sadece mağazadan teslim alınır.</p>
            </div>
          </label>

          <Textarea label="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />

          {/* New phone / tablet / smartwatch specs */}
          {(form.type === 'new_phone' || form.type === 'tablet' || form.type === 'smartwatch') && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-900">{form.type === 'tablet' ? 'Tablet' : form.type === 'smartwatch' ? 'Akıllı Saat' : 'Sıfır Telefon'} Özellikleri</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input label="Hafıza" value={form.memory} onChange={(e) => setForm({ ...form, memory: e.target.value })} placeholder="128GB" />
                <Input label="RAM" value={form.ram} onChange={(e) => setForm({ ...form, ram: e.target.value })} placeholder="4GB" />
                <Input label="Renk" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                <Input label="Ekran" value={form.screen_size} onChange={(e) => setForm({ ...form, screen_size: e.target.value })} placeholder="6.1 inç OLED" />
                <Input label="Kamera" value={form.camera_info} onChange={(e) => setForm({ ...form, camera_info: e.target.value })} placeholder="48MP + 12MP" />
                <Input label="Batarya" value={form.battery_capacity} onChange={(e) => setForm({ ...form, battery_capacity: e.target.value })} placeholder="4000 mAh" />
                <Input label="İşlemci" value={form.processor} onChange={(e) => setForm({ ...form, processor: e.target.value })} placeholder="A16 Bionic" />
                <Input label="İşletim Sistemi" value={form.operating_system} onChange={(e) => setForm({ ...form, operating_system: e.target.value })} placeholder="iOS 17" />
                <Input label="IMEI" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />
              </div>
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Garanti bilgisi otomatik olarak "2 Yıl Türkiye Garantili" olarak gösterilir.
              </p>
            </div>
          )}

          {/* Used phone condition fields */}
          {form.type === 'used_phone' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-900">2. El Durum Bilgileri</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input label="Hafıza" value={form.memory} onChange={(e) => setForm({ ...form, memory: e.target.value })} placeholder="128GB" />
                <Input label="RAM" value={form.ram} onChange={(e) => setForm({ ...form, ram: e.target.value })} placeholder="4GB" />
                <Input label="Renk" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                <Input label="IMEI" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />
                <Input label="Pil Sağlığı (%)" value={form.battery_health} onChange={(e) => setForm({ ...form, battery_health: e.target.value })} placeholder="87" />
                <Select label="Kozmetik Durum" value={form.cosmetic_condition} onChange={(e) => setForm({ ...form, cosmetic_condition: e.target.value })}>
                  <option value="">Seçin</option>
                  {COSMETIC_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Input label="Ekran Durumu" value={form.screen_condition} onChange={(e) => setForm({ ...form, screen_condition: e.target.value })} />
                <Select label="Face ID" value={form.face_id} onChange={(e) => setForm({ ...form, face_id: e.target.value })}>
                  <option value="">Seçin</option>
                  {STATUS_YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Select label="Touch ID" value={form.touch_id} onChange={(e) => setForm({ ...form, touch_id: e.target.value })}>
                  <option value="">Seçin</option>
                  {STATUS_YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Select label="True Tone" value={form.true_tone} onChange={(e) => setForm({ ...form, true_tone: e.target.value })}>
                  <option value="">Seçin</option>
                  {STATUS_YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Input label="Kamera Durumu" value={form.camera_condition} onChange={(e) => setForm({ ...form, camera_condition: e.target.value })} />
                <Input label="Hoparlör" value={form.speaker_condition} onChange={(e) => setForm({ ...form, speaker_condition: e.target.value })} />
                <Input label="Mikrofon" value={form.microphone_condition} onChange={(e) => setForm({ ...form, microphone_condition: e.target.value })} />
                <Input label="Garanti Durumu" value={form.warranty_status} onChange={(e) => setForm({ ...form, warranty_status: e.target.value })} />
                <Input label="Garanti Bitiş" type="date" value={form.warranty_end_date} onChange={(e) => setForm({ ...form, warranty_end_date: e.target.value })} />
                <Input label="Kutu Durumu" value={form.box_condition} onChange={(e) => setForm({ ...form, box_condition: e.target.value })} />
                <Input label="Şarj Aleti" value={form.charger_condition} onChange={(e) => setForm({ ...form, charger_condition: e.target.value })} />
              </div>
            </div>
          )}

          {/* Variant / Memory Options */}
          {canHaveVariants && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Varyant / Hafıza Seçenekleri</h3>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Bu ürün için farklı hafıza seçenekleri (örn. 128 GB, 256 GB, 512 GB) ekleyin. Her varyantın kendi fiyatı, stoğu ve SKU kodu olur. Varyant eklenmezse ürünün ana fiyatı ve stoğu kullanılır.
              </p>

              {variants.length === 0 ? (
                <p className="rounded-lg bg-white px-3 py-3 text-xs text-slate-400">Henüz varyant eklenmedi. Varyantsız ürünler ana fiyat ve stok ile satılır.</p>
              ) : (
                <div className="space-y-2">
                  {variants.map((v, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-3">
                      <div className="min-w-[100px] flex-1">
                        <label className="block text-[10px] text-slate-400">Hafıza</label>
                        <input
                          type="text"
                          value={v.storage}
                          onChange={(e) => updateVariant(idx, 'storage', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          placeholder="128 GB"
                        />
                      </div>
                      <div className="min-w-[90px] flex-1">
                        <label className="block text-[10px] text-slate-400">Fiyat (₺)</label>
                        <input
                          type="number"
                          min={0}
                          value={v.price}
                          onChange={(e) => updateVariant(idx, 'price', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          placeholder="23000"
                        />
                      </div>
                      <div className="min-w-[70px] flex-1">
                        <label className="block text-[10px] text-slate-400">Stok</label>
                        <input
                          type="number"
                          min={0}
                          value={v.stock}
                          onChange={(e) => updateVariant(idx, 'stock', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          placeholder="4"
                        />
                      </div>
                      <div className="min-w-[90px] flex-1">
                        <label className="block text-[10px] text-slate-400">SKU (opsiyonel)</label>
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          placeholder="A57-128"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={v.is_active}
                            onChange={(e) => updateVariant(idx, 'is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          Aktif
                        </label>
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addVariant}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-white"
              >
                <Plus className="h-4 w-4" />
                Hafıza Seçeneği Ekle
              </button>
            </div>
          )}

          {/* Installment configuration */}
          {(form.type === 'new_phone' || form.type === 'used_phone' || form.type === 'tablet' || form.type === 'smartwatch') && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Taksit Ayarları</h3>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Bu ürün için geçerli taksit sayılarını ve oranlarını belirleyin. Vade farkı 0 ise o taksit peşin fiyatına olur.
              </p>
              <div className="space-y-2">
                {['3', '6', '9', '12'].map((count) => (
                  <div key={count} className="flex items-center gap-3 rounded-lg bg-white p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 min-w-[80px]">
                      <input
                        type="checkbox"
                        checked={form.installment_enabled[count] || false}
                        onChange={(e) => setForm({
                          ...form,
                          installment_enabled: { ...form.installment_enabled, [count]: e.target.checked },
                        })}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      {count} Taksit
                    </label>
                    {form.installment_enabled[count] && (
                      <>
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400">Vade Farkı (%)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={form.installment_interest[count]}
                            onChange={(e) => setForm({
                              ...form,
                              installment_interest: { ...form.installment_interest, [count]: e.target.value },
                            })}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400">Komisyon (%)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={form.installment_commission[count]}
                            onChange={(e) => setForm({
                              ...form,
                              installment_commission: { ...form.installment_commission, [count]: e.target.value },
                            })}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            placeholder="2"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>İptal</Button>
          <Button className="flex-1" loading={saving} onClick={handleSave}>{editing ? 'Güncelle' : 'Kaydet'}</Button>
        </div>
      </Modal>
    </div>
  );
}
