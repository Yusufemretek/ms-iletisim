import { useEffect, useState, useCallback } from 'react';
import { Megaphone, Plus, X, Search, Tag, Package, FolderTree, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime } from '@/lib/format';
import { clearCampaignCache } from '@/lib/campaigns';
import { trError } from '@/lib/errors';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_cart_amount: number;
  scope_type: string;
  product_ids: string[] | null;
  category_ids: string[] | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

interface SimpleProduct {
  id: string;
  name: string;
  brand: string | null;
  category_id: string | null;
}

interface SimpleCategory {
  id: string;
  name: string;
}

export function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [categories, setCategories] = useState<SimpleCategory[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', discount_type: 'percentage', discount_value: 0,
    min_cart_amount: 0, end_date: '', scope_type: 'all',
  });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [notifyCustomers, setNotifyCustomers] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  }, []);

  const loadOptions = useCallback(async () => {
    const { data: prods } = await supabase.from('products').select('id, name, brand, category_id').eq('is_active', true).order('name');
    setProducts((prods as SimpleProduct[]) || []);
    const { data: cats } = await supabase.from('categories').select('id, name').order('name');
    setCategories((cats as SimpleCategory[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = () => {
    loadOptions();
    setForm({ name: '', description: '', discount_type: 'percentage', discount_value: 0, min_cart_amount: 0, end_date: '', scope_type: 'all' });
    setSelectedProductIds([]);
    setSelectedCategoryIds([]);
    setNotifyCustomers(true);
    setShowModal(true);
  };

  const filtered = campaigns.filter(c => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()));

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredProducts = products.filter(p =>
    !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.brand || '').toLowerCase().includes(productSearch.toLowerCase())
  );

  const scopeLabel = (c: Campaign) => {
    if (c.scope_type === 'all') return 'Tüm Ürünler';
    if (c.scope_type === 'products') return `${c.product_ids?.length || 0} Ürün`;
    if (c.scope_type === 'categories') return `${c.category_ids?.length || 0} Kategori`;
    return 'Tüm Ürünler';
  };

  const handleAdd = async () => {
    setError('');
    if (!form.name.trim()) { setError('Kampanya adı zorunludur'); return; }
    if (form.scope_type === 'products' && selectedProductIds.length === 0) { setError('En az bir ürün seçin'); return; }
    if (form.scope_type === 'categories' && selectedCategoryIds.length === 0) { setError('En az bir kategori seçin'); return; }
    setSaving(true);

    const insertData: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_cart_amount: Number(form.min_cart_amount),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      scope_type: form.scope_type,
      product_ids: form.scope_type === 'products' ? selectedProductIds : [],
      category_ids: form.scope_type === 'categories' ? selectedCategoryIds : [],
      is_active: true,
    };

    const { error: err } = await supabase.from('campaigns').insert(insertData);

    if (err) {
      setError(trError(err));
      setSaving(false);
      return;
    }

    if (notifyCustomers) {
      await supabase.rpc('notify_campaign_created', {
        p_campaign_name: form.name,
        p_campaign_description: form.description || null,
      });
    }

    setSaving(false);
    setShowModal(false);
    clearCampaignCache();
    load();
  };

  const toggleActive = async (c: Campaign) => {
    await supabase.from('campaigns').update({ is_active: !c.is_active }).eq('id', c.id);
    clearCampaignCache();
    load();
  };

  const deleteCampaign = async (c: Campaign) => {
    if (!confirm(`"${c.name}" kampanyasını silmek istediğinize emin misiniz?`)) return;
    await supabase.from('campaigns').delete().eq('id', c.id);
    clearCampaignCache();
    load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Megaphone className="h-6 w-6 text-amber-500" /> Kampanyalar
          </h1>
          <p className="mt-1 text-sm text-slate-500">İndirim ve kampanya yönetimi</p>
        </div>
        <Button onClick={openModal}>
          <Plus className="h-4 w-4" /> Kampanya Ekle
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Kampanya ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Megaphone className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Kampanya yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="premium-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <Badge variant={c.is_active ? 'success' : 'default'}>{c.is_active ? 'Aktif' : 'Pasif'}</Badge>
                      <Badge variant="info">{scopeLabel(c)}</Badge>
                    </div>
                    {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
                    <p className="text-xs text-slate-400">
                      {c.discount_type === 'percentage' ? `%${c.discount_value}` : `${formatPrice(c.discount_value)}`} indirim
                      {c.min_cart_amount > 0 && ` • Min: ${formatPrice(c.min_cart_amount)}`}
                    </p>
                    <p className="text-xs text-slate-300">{formatDateTime(c.start_date)} {c.end_date && `→ ${formatDateTime(c.end_date)}`}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleActive(c)}>
                    {c.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => deleteCampaign(c)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Kampanya Ekle</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              <Input label="Kampanya Adı *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Textarea label="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />

              <div className="grid grid-cols-2 gap-3">
                <Select label="İndirim Tipi" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                  <option value="percentage">Yüzde (%)</option>
                  <option value="fixed">Sabit Tutar (₺)</option>
                </Select>
                <Input label="İndirim Değeri" type="number" min={0} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
              </div>

              <Input label="Min. Sepet Tutarı (₺)" type="number" min={0} value={form.min_cart_amount} onChange={(e) => setForm({ ...form, min_cart_amount: Number(e.target.value) })} />

              {/* Scope selection */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">İndirim Nerede Geçerli?</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, scope_type: 'all' })}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors ${form.scope_type === 'all' ? 'border-electric-500 bg-electric-50 text-electric-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Tag className="h-5 w-5" /> Tüm Ürünler
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, scope_type: 'products' })}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors ${form.scope_type === 'products' ? 'border-electric-500 bg-electric-50 text-electric-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Package className="h-5 w-5" /> Belirli Ürünler
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, scope_type: 'categories' })}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors ${form.scope_type === 'categories' ? 'border-electric-500 bg-electric-50 text-electric-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <FolderTree className="h-5 w-5" /> Kategori
                  </button>
                </div>
              </div>

              {/* Product picker */}
              {form.scope_type === 'products' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Ürün Seçin *</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Ürün ara..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                    {filteredProducts.map(p => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleProduct(p.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{p.name} <span className="text-slate-400">• {p.brand}</span></span>
                      </label>
                    ))}
                  </div>
                  {selectedProductIds.length > 0 && <p className="mt-1 text-xs text-electric-600">{selectedProductIds.length} ürün seçildi</p>}
                </div>
              )}

              {/* Category picker */}
              {form.scope_type === 'categories' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Kategori Seçin *</label>
                  <div className="space-y-1 rounded-xl border border-slate-200 p-2">
                    {categories.map(cat => (
                      <label key={cat.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{cat.name}</span>
                      </label>
                    ))}
                    {categories.length === 0 && <p className="p-2 text-xs text-slate-400">Kategori yok.</p>}
                  </div>
                  {selectedCategoryIds.length > 0 && <p className="mt-1 text-xs text-electric-600">{selectedCategoryIds.length} kategori seçildi</p>}
                </div>
              )}

              <Input label="Bitiş Tarihi" type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />

              {/* Notify customers */}
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3">
                <input type="checkbox" checked={notifyCustomers} onChange={(e) => setNotifyCustomers(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Bell className="h-4 w-4 text-amber-500" /> Tüm müşterilere bildirim gönder
                </span>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleAdd}>Ekle</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
