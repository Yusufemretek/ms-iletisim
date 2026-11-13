import { useEffect, useState, useCallback } from 'react';
import { Signal, Plus, X, Search, Edit3, Archive, Eye, Power, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDate } from '@/lib/format';
import { formatInternet, formatMinutes, formatSms, formatCommitment, formatPriceOrRequest, slugify, isCampaignExpired } from '@/lib/operator-campaigns';
import type { Operator, OperatorCampaignCategory } from '@/lib/types';
import { trError } from '@/lib/errors';

interface AdminCampaign extends Record<string, unknown> {
  id: string;
  operator_id: string;
  operator_name: string;
  operator_color: string;
  category_id: string | null;
  category_name: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  monthly_price: number | null;
  price_on_request: boolean;
  internet_gb: number | null;
  internet_unlimited: boolean;
  minutes: number | null;
  minutes_unlimited: boolean;
  sms: number | null;
  sms_unlimited: boolean;
  commitment_months: number | null;
  eligibility: string[];
  age_requirement: number | null;
  start_date: string;
  end_date: string | null;
  terms: string | null;
  featured: boolean;
  active: boolean;
  archived: boolean;
  lead_count: number;
  created_at: string;
}

const ELIGIBILITY_OPTIONS = [
  { val: 'new_line', label: 'Yeni Hat' },
  { val: 'number_portability', label: 'Numara Taşıma' },
  { val: 'existing_customer', label: 'Mevcut Müşteri' },
  { val: 'youth', label: 'Genç' },
  { val: 'prepaid', label: 'Faturasız' },
  { val: 'postpaid', label: 'Faturalı' },
];

export function AdminOperatorCampaignsPage() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [categories, setCategories] = useState<OperatorCampaignCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<AdminCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<AdminCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    id: '',
    operator_id: '',
    category_id: '',
    name: '',
    short_description: '',
    description: '',
    image_url: '',
    monthly_price: '',
    price_on_request: false,
    internet_gb: '',
    internet_unlimited: false,
    minutes: '',
    minutes_unlimited: false,
    sms: '',
    sms_unlimited: false,
    commitment_months: '',
    eligibility: [] as string[],
    age_requirement: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    terms: '',
    featured: false,
    active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [campRes, opRes, catRes] = await Promise.all([
      supabase.rpc('get_admin_operator_campaigns'),
      supabase.from('operators').select('*').order('sort_order', { ascending: true }),
      supabase.from('operator_campaign_categories').select('*').order('sort_order', { ascending: true }),
    ]);
    if (campRes.error) {
      console.error('Kampanyalar yüklenemedi:', campRes.error.message);
      setError('Kampanyalar yüklenemedi: ' + trError(campRes.error));
    }
    setCampaigns((campRes.data as unknown as AdminCampaign[]) || []);
    setOperators((opRes.data as Operator[]) || []);
    setCategories((catRes.data as OperatorCampaignCategory[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = campaigns.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.operator_name || '').toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      id: '', operator_id: operators[0]?.id || '', category_id: '', name: '',
      short_description: '', description: '', image_url: '',
      monthly_price: '', price_on_request: false,
      internet_gb: '', internet_unlimited: false, minutes: '', minutes_unlimited: false,
      sms: '', sms_unlimited: false, commitment_months: '', eligibility: [],
      age_requirement: '', start_date: new Date().toISOString().slice(0, 10),
      end_date: '', terms: '', featured: false, active: true,
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: AdminCampaign) => {
    setEditing(c);
    setForm({
      id: c.id, operator_id: c.operator_id, category_id: c.category_id || '',
      name: c.name, short_description: c.short_description || '', description: c.description || '',
      image_url: c.image_url || '', monthly_price: c.monthly_price != null ? String(c.monthly_price) : '',
      price_on_request: c.price_on_request, internet_gb: c.internet_gb != null ? String(c.internet_gb) : '',
      internet_unlimited: c.internet_unlimited, minutes: c.minutes != null ? String(c.minutes) : '',
      minutes_unlimited: c.minutes_unlimited, sms: c.sms != null ? String(c.sms) : '',
      sms_unlimited: c.sms_unlimited, commitment_months: c.commitment_months != null ? String(c.commitment_months) : '',
      eligibility: c.eligibility || [], age_requirement: c.age_requirement != null ? String(c.age_requirement) : '',
      start_date: c.start_date ? c.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      end_date: c.end_date ? c.end_date.slice(0, 10) : '', terms: c.terms || '',
      featured: c.featured, active: c.active,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setError('');
    if (!form.operator_id) { setError('Operatör seçimi zorunludur'); return; }
    if (!form.name.trim()) { setError('Kampanya adı zorunludur'); return; }

    setSaving(true);
    const slug = editing ? editing.slug : slugify(form.name);

    const payload = {
      id: form.id || null,
      operator_id: form.operator_id,
      category_id: form.category_id || null,
      name: form.name.trim(),
      slug,
      short_description: form.short_description || null,
      description: form.description || null,
      image_url: form.image_url || null,
      monthly_price: form.monthly_price ? Number(form.monthly_price) : null,
      price_on_request: form.price_on_request,
      internet_gb: form.internet_gb ? Number(form.internet_gb) : null,
      internet_unlimited: form.internet_unlimited,
      minutes: form.minutes ? Number(form.minutes) : null,
      minutes_unlimited: form.minutes_unlimited,
      sms: form.sms ? Number(form.sms) : null,
      sms_unlimited: form.sms_unlimited,
      commitment_months: form.commitment_months ? Number(form.commitment_months) : null,
      eligibility: form.eligibility,
      age_requirement: form.age_requirement ? Number(form.age_requirement) : null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      terms: form.terms || null,
      featured: form.featured,
      active: form.active,
    };

    const { error: err } = await supabase.rpc('upsert_operator_campaign', { p_data: payload });
    setSaving(false);

    if (err) { setError(trError(err)); return; }

    setShowModal(false);
    load();
  };

  const handleArchive = async (id: string) => {
    await supabase.rpc('archive_operator_campaign', { p_campaign_id: id });
    load();
  };

  const handleDelete = async () => {
    if (!deletingCampaign) return;
    setDeleting(true);
    const { error: err } = await supabase.rpc('delete_operator_campaign', { p_campaign_id: deletingCampaign.id });
    setDeleting(false);
    if (err) {
      setError(trError(err));
      return;
    }
    setShowDeleteModal(false);
    setDeletingCampaign(null);
    setError('');
    load();
  };

  const openDelete = (c: AdminCampaign) => {
    setDeletingCampaign(c);
    setError('');
    setShowDeleteModal(true);
  };

  const toggleActive = async (c: AdminCampaign) => {
    const payload = {
      id: c.id,
      operator_id: c.operator_id,
      category_id: c.category_id || null,
      name: c.name,
      slug: c.slug,
      short_description: c.short_description || null,
      description: c.description || null,
      image_url: c.image_url || null,
      monthly_price: c.monthly_price,
      price_on_request: c.price_on_request,
      internet_gb: c.internet_gb,
      internet_unlimited: c.internet_unlimited,
      minutes: c.minutes,
      minutes_unlimited: c.minutes_unlimited,
      sms: c.sms,
      sms_unlimited: c.sms_unlimited,
      commitment_months: c.commitment_months,
      eligibility: c.eligibility || [],
      age_requirement: c.age_requirement,
      start_date: c.start_date,
      end_date: c.end_date || null,
      terms: c.terms || null,
      featured: c.featured,
      active: !c.active,
    };
    await supabase.rpc('upsert_operator_campaign', { p_data: payload });
    load();
  };

  const toggleEligibility = (val: string) => {
    setForm(f => ({
      ...f,
      eligibility: f.eligibility.includes(val)
        ? f.eligibility.filter(e => e !== val)
        : [...f.eligibility, val],
    }));
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Signal className="h-6 w-6 text-electric-600" /> Operatör Kampanyaları
          </h1>
          <p className="mt-1 text-sm text-slate-500">Kampanya oluşturun, düzenleyin ve yönetin</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Yeni Kampanya
        </Button>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Kampanya ara..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Signal className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz kampanya yok.</p>
          <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4" /> İlk Kampanyayı Ekle</Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="px-3 py-2 font-medium">Operatör</th>
                <th className="px-3 py-2 font-medium">Kampanya</th>
                <th className="px-3 py-2 font-medium">Tür</th>
                <th className="px-3 py-2 font-medium">Fiyat</th>
                <th className="px-3 py-2 font-medium">Başlangıç</th>
                <th className="px-3 py-2 font-medium">Bitiş</th>
                <th className="px-3 py-2 font-medium">Durum</th>
                <th className="px-3 py-2 font-medium">Talep</th>
                <th className="px-3 py-2 font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const expired = c.end_date && new Date(c.end_date) < new Date(new Date().toDateString());
                return (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.operator_color }} />
                        <span className="text-slate-600">{c.operator_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700">{c.name}</p>
                      {c.featured && <span className="text-xs text-amber-500">Öne Çıkan</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{c.category_name || '-'}</td>
                    <td className="px-3 py-3 text-slate-600">{c.price_on_request ? 'Bilgi Al' : c.monthly_price != null ? formatPrice(c.monthly_price) : '-'}</td>
                    <td className="px-3 py-3 text-slate-500">{c.start_date ? formatDate(c.start_date) : '-'}</td>
                    <td className="px-3 py-3 text-slate-500">{c.end_date ? formatDate(c.end_date) : '-'}</td>
                    <td className="px-3 py-3">
                      {c.archived ? (
                        <Badge variant="default">Arşivlendi</Badge>
                      ) : expired ? (
                        <Badge variant="error">Süresi Doldu</Badge>
                      ) : c.active ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="warning">Pasif</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{c.lead_count || 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-electric-600" title="Düzenle">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => toggleActive(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-500" title={c.active ? 'Pasifleştir' : 'Aktifleştir'}>
                          <Power className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleArchive(c.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-500" title="Arşivle">
                          <Archive className="h-4 w-4" />
                        </button>
                        <button onClick={() => openDelete(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-500" title="Sil">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Kampanyayı Düzenle' : 'Yeni Kampanya'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

            <div className="space-y-3">
              {/* Operator + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Operatör *</label>
                  <select value={form.operator_id} onChange={e => setForm({ ...form, operator_id: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Kampanya Türü</label>
                  <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    <option value="">Seçiniz</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Kampanya Adı *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" placeholder="örn: 40 GB Numara Taşıma Kampanyası" />
              </div>

              {/* Short description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Kısa Açıklama</label>
                <textarea value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Detaylı Açıklama</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
              </div>

              {/* Image URL */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Kampanya Görseli (URL)</label>
                <input type="text" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" placeholder="https://..." />
              </div>

              {/* Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Aylık Fiyat (₺)</label>
                  <input type="number" min={0} step="0.01" value={form.monthly_price} onChange={e => setForm({ ...form, monthly_price: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" disabled={form.price_on_request} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={form.price_on_request} onChange={e => setForm({ ...form, price_on_request: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    Fiyat için bilgi al
                  </label>
                </div>
              </div>

              {/* Internet */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">İnternet (GB)</label>
                  <input type="number" min={0} value={form.internet_gb} onChange={e => setForm({ ...form, internet_gb: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" disabled={form.internet_unlimited} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={form.internet_unlimited} onChange={e => setForm({ ...form, internet_unlimited: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    Sınırsız internet
                  </label>
                </div>
              </div>

              {/* Minutes + SMS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Dakika</label>
                  <input type="number" min={0} value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" disabled={form.minutes_unlimited} />
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <input type="checkbox" checked={form.minutes_unlimited} onChange={e => setForm({ ...form, minutes_unlimited: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-300" />
                    Sınırsız dakika
                  </label>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">SMS</label>
                  <input type="number" min={0} value={form.sms} onChange={e => setForm({ ...form, sms: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" disabled={form.sms_unlimited} />
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <input type="checkbox" checked={form.sms_unlimited} onChange={e => setForm({ ...form, sms_unlimited: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-300" />
                    Sınırsız SMS
                  </label>
                </div>
              </div>

              {/* Commitment + Age */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Taahhüt Süresi (Ay)</label>
                  <input type="number" min={0} value={form.commitment_months} onChange={e => setForm({ ...form, commitment_months: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" placeholder="0 = Taahhütsüz" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Yaş Şartı</label>
                  <input type="number" min={0} value={form.age_requirement} onChange={e => setForm({ ...form, age_requirement: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" placeholder="Boş = şart yok" />
                </div>
              </div>

              {/* Eligibility */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Kimler Yararlanabilir?</label>
                <div className="flex flex-wrap gap-2">
                  {ELIGIBILITY_OPTIONS.map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => toggleEligibility(opt.val)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${form.eligibility.includes(opt.val) ? 'border-electric-500 bg-electric-50 text-electric-600' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Başlangıç Tarihi</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Bitiş Tarihi</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
                </div>
              </div>

              {/* Terms */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Kampanya Koşulları</label>
                <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                  Öne Çıkan Kampanya
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                  Aktif
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleSave}>{editing ? 'Güncelle' : 'Kaydet'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingCampaign && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Kampanyayı Sil</h2>
                <p className="text-sm text-slate-500">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

            <p className="mb-4 text-sm text-slate-600">
              <span className="font-medium">{deletingCampaign.name}</span> kampanyasını kalıcı olarak silmek istediğinize emin misiniz?
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDeleteModal(false); setDeletingCampaign(null); setError(''); }}>İptal</Button>
              <Button className="flex-1" loading={deleting} onClick={handleDelete}>Sil</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
