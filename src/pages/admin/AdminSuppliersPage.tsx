import { useEffect, useState, useCallback } from 'react';
import { Truck, Plus, Search, Mail, Phone, MapPin, Trash2, Edit2, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { trError } from '@/lib/errors';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(trError(error));
    } else {
      setSuppliers((data as Supplier[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const filtered = suppliers.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_person?.toLowerCase().includes(q) ?? false) ||
      (s.email?.toLowerCase().includes(q) ?? false) ||
      (s.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      contact_person: s.contact_person ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    });
    setEditId(s.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Tedarikçi adı zorunludur.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editId) {
      const { error } = await supabase
        .from('suppliers')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editId);
      if (error) setError(trError(error));
    } else {
      const { error } = await supabase.from('suppliers').insert(payload);
      if (error) setError(trError(error));
    }

    if (!error) {
      setModalOpen(false);
      setForm(emptyForm);
      setEditId(null);
      loadSuppliers();
    }
    setSaving(false);
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`"${s.name}" tedarikçisini silmek istediğinize emin misiniz?`)) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', s.id);
    if (error) {
      setError(trError(error));
    } else {
      loadSuppliers();
    }
  };

  const toggleActive = async (s: Supplier) => {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: !s.is_active, updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (error) {
      setError(trError(error));
    } else {
      loadSuppliers();
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tedarikçiler</h1>
          <p className="mt-1 text-sm text-slate-500">{suppliers.length} tedarikçi</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Tedarikçi Ekle
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="İsim, e-posta veya telefon ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Truck className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            {search ? 'Aramanızla eşleşen tedarikçi bulunamadı.' : 'Henüz tedarikçi tanımlanmamış.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-50">
                    <Truck className="h-5 w-5 text-electric-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    {s.contact_person && (
                      <p className="text-xs text-slate-500">{s.contact_person}</p>
                    )}
                  </div>
                </div>
                <Badge variant={s.is_active ? 'success' : 'default'}>
                  {s.is_active ? 'Aktif' : 'Pasif'}
                </Badge>
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                {s.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {s.phone}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {s.email}
                  </p>
                )}
                {s.address && (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {s.address}
                  </p>
                )}
              </div>

              {s.notes && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{s.notes}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => openEdit(s)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Düzenle
                </button>
                <button
                  onClick={() => toggleActive(s)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {s.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="ml-auto rounded-lg border border-red-200 px-2.5 py-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Tedarikçi Düzenle' : 'Tedarikçi Ekle'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Tedarikçi Adı *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Örn: ABC Telekom"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">İletişim Kişisi</label>
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="Ad Soyad"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefon</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="05XX XXX XX XX"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="info@tedarikci.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Adres</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Adres bilgisi"
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Notlar</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ek bilgiler..."
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              <X className="h-4 w-4" /> İptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              <Check className="h-4 w-4" /> {editId ? 'Kaydet' : 'Ekle'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
