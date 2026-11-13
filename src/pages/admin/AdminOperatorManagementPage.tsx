import { useEffect, useState, useCallback } from 'react';
import { Signal, Plus, X, Edit3, Power, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { slugify } from '@/lib/operator-campaigns';
import type { Operator, OperatorCampaignCategory } from '@/lib/types';
import { trError } from '@/lib/errors';

export function AdminOperatorManagementPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [categories, setCategories] = useState<OperatorCampaignCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpModal, setShowOpModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingOp, setEditingOp] = useState<Operator | null>(null);
  const [editingCat, setEditingCat] = useState<OperatorCampaignCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [opForm, setOpForm] = useState({ id: '', name: '', slug: '', logo_url: '', color: '#6366f1', active: true, sort_order: '0' });
  const [catForm, setCatForm] = useState({ id: '', name: '', slug: '', active: true, sort_order: '0' });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: opData }, { data: catData }] = await Promise.all([
      supabase.from('operators').select('*').order('sort_order', { ascending: true }),
      supabase.from('operator_campaign_categories').select('*').order('sort_order', { ascending: true }),
    ]);
    setOperators((opData as Operator[]) || []);
    setCategories((catData as OperatorCampaignCategory[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreateOp = () => {
    setEditingOp(null);
    setOpForm({ id: '', name: '', slug: '', logo_url: '', color: '#6366f1', active: true, sort_order: '0' });
    setError('');
    setShowOpModal(true);
  };

  const openEditOp = (op: Operator) => {
    setEditingOp(op);
    setOpForm({ id: op.id, name: op.name, slug: op.slug, logo_url: op.logo_url || '', color: op.color, active: op.active, sort_order: String(op.sort_order) });
    setError('');
    setShowOpModal(true);
  };

  const handleSaveOp = async () => {
    setError('');
    if (!opForm.name.trim()) { setError('Operatör adı zorunludur'); return; }
    setSaving(true);
    const slug = opForm.slug || slugify(opForm.name);
    const { error: err } = await supabase.rpc('upsert_operator', {
      p_data: { id: opForm.id || null, name: opForm.name.trim(), slug, logo_url: opForm.logo_url || null, color: opForm.color, active: opForm.active, sort_order: opForm.sort_order || '0' },
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setShowOpModal(false);
    load();
  };

  const toggleOpActive = async (op: Operator) => {
    await supabase.from('operators').update({ active: !op.active, updated_at: new Date().toISOString() }).eq('id', op.id);
    load();
  };

  const openCreateCat = () => {
    setEditingCat(null);
    setCatForm({ id: '', name: '', slug: '', active: true, sort_order: '0' });
    setError('');
    setShowCatModal(true);
  };

  const openEditCat = (cat: OperatorCampaignCategory) => {
    setEditingCat(cat);
    setCatForm({ id: cat.id, name: cat.name, slug: cat.slug, active: cat.active, sort_order: String(cat.sort_order) });
    setError('');
    setShowCatModal(true);
  };

  const handleSaveCat = async () => {
    setError('');
    if (!catForm.name.trim()) { setError('Kategori adı zorunludur'); return; }
    setSaving(true);
    const slug = catForm.slug || slugify(catForm.name);
    const { error: err } = await supabase.rpc('upsert_campaign_category', {
      p_data: { id: catForm.id || null, name: catForm.name.trim(), slug, active: catForm.active, sort_order: catForm.sort_order || '0' },
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setShowCatModal(false);
    load();
  };

  const toggleCatActive = async (cat: OperatorCampaignCategory) => {
    await supabase.from('operator_campaign_categories').update({ active: !cat.active }).eq('id', cat.id);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" /></div>;
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Signal className="h-6 w-6 text-electric-600" /> Operatör & Kategori Yönetimi
        </h1>
        <p className="mt-1 text-sm text-slate-500">Operatörleri ve kampanya kategorilerini yönetin</p>
      </div>

      {/* Operators */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">Operatörler</h2>
          <Button size="sm" onClick={openCreateOp}><Plus className="h-3.5 w-3.5" /> Operatör Ekle</Button>
        </div>
        <div className="space-y-2">
          {operators.map(op => (
            <div key={op.id} className="premium-card flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                {op.logo_url ? (
                  <img src={op.logo_url} alt={op.name} className="h-8 w-8 rounded-lg object-contain" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: op.color }}>
                    {op.name[0]}
                  </span>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-700">{op.name}</p>
                  <p className="text-xs text-slate-400">/{op.slug} • sıra: {op.sort_order}</p>
                </div>
                <Badge variant={op.active ? 'success' : 'default'}>{op.active ? 'Aktif' : 'Pasif'}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEditOp(op)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-electric-600"><Edit3 className="h-4 w-4" /></button>
                <button onClick={() => toggleOpActive(op)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-500"><Power className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">Kampanya Kategorileri</h2>
          <Button size="sm" onClick={openCreateCat}><Plus className="h-3.5 w-3.5" /> Kategori Ekle</Button>
        </div>
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="premium-card flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <Tag className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{cat.name}</p>
                  <p className="text-xs text-slate-400">/{cat.slug} • sıra: {cat.sort_order}</p>
                </div>
                <Badge variant={cat.active ? 'success' : 'default'}>{cat.active ? 'Aktif' : 'Pasif'}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEditCat(cat)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-electric-600"><Edit3 className="h-4 w-4" /></button>
                <button onClick={() => toggleCatActive(cat)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-500"><Power className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operator modal */}
      {showOpModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowOpModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{editingOp ? 'Operatörü Düzenle' : 'Yeni Operatör'}</h2>
              <button onClick={() => setShowOpModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Operatör Adı *</label>
                <input type="text" value={opForm.name} onChange={e => setOpForm({ ...opForm, name: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Logo URL</label>
                <input type="text" value={opForm.logo_url} onChange={e => setOpForm({ ...opForm, logo_url: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Renk</label>
                  <input type="color" value={opForm.color} onChange={e => setOpForm({ ...opForm, color: e.target.value })} className="h-10 w-full rounded-lg border border-slate-200 bg-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Sıra</label>
                  <input type="number" min={0} value={opForm.sort_order} onChange={e => setOpForm({ ...opForm, sort_order: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={opForm.active} onChange={e => setOpForm({ ...opForm, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                Aktif
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowOpModal(false)}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleSaveOp}>{editingOp ? 'Güncelle' : 'Ekle'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Category modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowCatModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{editingCat ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}</h2>
              <button onClick={() => setShowCatModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Kategori Adı *</label>
                <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Sıra</label>
                <input type="number" min={0} value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={catForm.active} onChange={e => setCatForm({ ...catForm, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                Aktif
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCatModal(false)}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleSaveCat}>{editingCat ? 'Güncelle' : 'Ekle'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
