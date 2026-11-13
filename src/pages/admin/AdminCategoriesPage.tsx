import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Category } from '@/lib/types';
import { trError } from '@/lib/errors';

function slugify(text: string): string {
  const map: Record<string, string> = { 'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ş': 's', 'Ş': 's', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };
  return text.replace(/[ıİğĞüÜşŞöÖçÇ]/g, (c) => map[c] || c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<(Category & { product_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').order('name');
    const cats = data as Category[] || [];
    // Count products per category
    const { data: prods } = await supabase.from('products').select('category_id');
    const counts: Record<string, number> = {};
    (prods || []).forEach((p: { category_id: string | null }) => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    setCategories(cats.map((c) => ({ ...c, product_count: counts[c.id] || 0 })));
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setName(''); setError(''); setShowModal(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setName(cat.name); setError(''); setShowModal(true); };

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Kategori adı zorunludur.'); return; }
    setSaving(true);
    let err: { message: string } | null = null;
    if (editing) {
      const res = await supabase.from('categories').update({ name, slug: slugify(name) }).eq('id', editing.id);
      err = res.error;
    } else {
      const res = await supabase.from('categories').insert({ name, slug: slugify(name) });
      err = res.error;
    }
    setSaving(false);
    if (err) {
      if (err.message.includes('duplicate') || err.message.includes('unique')) {
        setError('Bu isimde bir kategori zaten var. Lütfen farklı bir isim kullanın.');
      } else {
        setError(trError(err));
      }
      return;
    }
    setShowModal(false);
    loadCategories();
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`"${cat.name}" kategorisini silmek istediğinize emin misiniz?`)) return;
    await supabase.from('categories').delete().eq('id', cat.id);
    loadCategories();
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kategoriler</h1>
          <p className="mt-1 text-sm text-slate-500">{categories.length} kategori</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Yeni Kategori</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Tag className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz kategori yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{cat.name}</p>
                  <p className="text-xs text-slate-400">{cat.product_count} ürün</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(cat)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(cat)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Kategori Düzenle' : 'Yeni Kategori'}>
        {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <Input label="Kategori Adı" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Kulaklık" />
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>İptal</Button>
          <Button className="flex-1" loading={saving} onClick={handleSave}>{editing ? 'Güncelle' : 'Kaydet'}</Button>
        </div>
      </Modal>
    </div>
  );
}
