import { useEffect, useState, useCallback } from 'react';
import { Recycle, Plus, Search, Smartphone, X, Banknote, CreditCard, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/format';
import { trError } from '@/lib/errors';

interface UsedDevice {
  id: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  imei: string | null;
  battery_health: string | null;
  cosmetic_grade: string | null;
  screen_condition: string | null;
  body_condition: string | null;
  camera_condition: string | null;
  face_id_status: string | null;
  touch_id_status: string | null;
  original_screen: boolean;
  changed_parts: string | null;
  warranty_status: string | null;
  purchase_price: number;
  sale_price: number;
  status: string;
  description: string | null;
  created_at: string;
}

export function AdminUsedDevicesPage() {
  const [devices, setDevices] = useState<UsedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [sellDevice, setSellDevice] = useState<UsedDevice | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    brand: '', model: '', storage: '', color: '', imei: '', battery_health: '',
    cosmetic_grade: '', screen_condition: '', body_condition: '', camera_condition: '',
    face_id_status: '', touch_id_status: '', original_screen: 'true', changed_parts: '',
    warranty_status: '', purchase_price: 0, sale_price: 0, description: '',
  });

  const loadDevices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('used_devices').select('*').order('created_at', { ascending: false });
    setDevices((data as UsedDevice[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const filtered = devices.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return d.brand.toLowerCase().includes(q) || d.model.toLowerCase().includes(q) || (d.imei || '').includes(q);
    }
    return true;
  });

  const handleAdd = async () => {
    setError('');
    if (!form.brand || !form.model) { setError('Marka ve model zorunludur'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('used_devices').insert({
      brand: form.brand,
      model: form.model,
      storage: form.storage || null,
      color: form.color || null,
      imei: form.imei || null,
      battery_health: form.battery_health || null,
      cosmetic_grade: form.cosmetic_grade || null,
      screen_condition: form.screen_condition || null,
      body_condition: form.body_condition || null,
      camera_condition: form.camera_condition || null,
      face_id_status: form.face_id_status || null,
      touch_id_status: form.touch_id_status || null,
      original_screen: form.original_screen === 'true',
      changed_parts: form.changed_parts || null,
      warranty_status: form.warranty_status || null,
      purchase_price: Number(form.purchase_price),
      sale_price: Number(form.sale_price),
      description: form.description || null,
      status: 'available',
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setShowModal(false);
    setForm({ brand: '', model: '', storage: '', color: '', imei: '', battery_health: '', cosmetic_grade: '', screen_condition: '', body_condition: '', camera_condition: '', face_id_status: '', touch_id_status: '', original_screen: 'true', changed_parts: '', warranty_status: '', purchase_price: 0, sale_price: 0, description: '' });
    loadDevices();
  };

  const handleSell = async (paymentMethod: string) => {
    if (!sellDevice) return;
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('sell_used_device', {
      p_device_id: sellDevice.id,
      p_payment_method: paymentMethod,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setSellDevice(null);
    loadDevices();
  };

  const statusVariant = (status: string): 'default' | 'info' | 'success' | 'amber' | 'error' => {
    switch (status) {
      case 'available': return 'success';
      case 'reserved': return 'amber';
      case 'sold': return 'default';
      case 'service': return 'info';
      case 'inactive': return 'error';
      default: return 'default';
    }
  };

  const statusLabels: Record<string, string> = {
    available: 'Mevcut', reserved: 'Rezerve', sold: 'Satıldı', service: 'Serviste', inactive: 'Pasif',
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Recycle className="h-6 w-6 text-emerald-600" /> 2. El Cihazlar
          </h1>
          <p className="mt-1 text-sm text-slate-500">Her cihaz ayrı kayıt olarak tutulur</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> Cihaz Ekle
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none">
          <option value="all">Tüm Durumlar</option>
          <option value="available">Mevcut</option>
          <option value="sold">Satıldı</option>
          <option value="reserved">Rezerve</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Smartphone className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">2. el cihaz yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={d.id} className="premium-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{d.brand} {d.model}</p>
                      <Badge variant={statusVariant(d.status)}>{statusLabels[d.status] || d.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      {d.storage} • {d.color} {d.imei && `• IMEI: ${d.imei.slice(0,4)}••••`}
                      {d.battery_health && ` • Pil: ${d.battery_health}%`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-electric-600">{formatPrice(d.sale_price)}</p>
                  <p className="text-xs text-slate-400">Alış: {formatPrice(d.purchase_price)}</p>
                  <p className="text-xs text-emerald-600">Kâr: {formatPrice(d.sale_price - d.purchase_price)}</p>
                </div>
              </div>
              {d.status === 'available' && (
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSellDevice(d)}>
                    <Banknote className="h-3.5 w-3.5" /> Sat
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">2. El Cihaz Ekle</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Marka *" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <Input label="Model *" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <Input label="Hafıza" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
              <Input label="Renk" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              <Input label="IMEI" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} maxLength={15} />
              <Input label="Pil Sağlığı %" value={form.battery_health} onChange={(e) => setForm({ ...form, battery_health: e.target.value })} />
              <Input label="Kozmetik" value={form.cosmetic_grade} onChange={(e) => setForm({ ...form, cosmetic_grade: e.target.value })} />
              <Input label="Ekran" value={form.screen_condition} onChange={(e) => setForm({ ...form, screen_condition: e.target.value })} />
              <Input label="Kasa" value={form.body_condition} onChange={(e) => setForm({ ...form, body_condition: e.target.value })} />
              <Input label="Kamera" value={form.camera_condition} onChange={(e) => setForm({ ...form, camera_condition: e.target.value })} />
              <Input label="Face ID" value={form.face_id_status} onChange={(e) => setForm({ ...form, face_id_status: e.target.value })} />
              <Input label="Touch ID" value={form.touch_id_status} onChange={(e) => setForm({ ...form, touch_id_status: e.target.value })} />
              <Select label="Orijinal Ekran" value={form.original_screen} onChange={(e) => setForm({ ...form, original_screen: e.target.value })}>
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </Select>
              <Input label="Garanti" value={form.warranty_status} onChange={(e) => setForm({ ...form, warranty_status: e.target.value })} />
              <Input label="Alış Fiyatı (₺)" type="number" min={0} value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
              <Input label="Satış Fiyatı (₺)" type="number" min={0} value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} />
            </div>
            <Textarea label="Değişen Parçalar" value={form.changed_parts} onChange={(e) => setForm({ ...form, changed_parts: e.target.value })} rows={2} />
            <Textarea label="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleAdd}>Ekle</Button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {sellDevice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSellDevice(null)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <h2 className="mb-4 text-lg font-bold text-slate-900">2. El Cihaz Sat</h2>
            <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-900">{sellDevice.brand} {sellDevice.model}</p>
              <p className="text-slate-500">Satış: {formatPrice(sellDevice.sale_price)} • Alış: {formatPrice(sellDevice.purchase_price)}</p>
              <p className="text-emerald-600">Kâr: {formatPrice(sellDevice.sale_price - sellDevice.purchase_price)}</p>
            </div>
            <p className="mb-3 text-sm text-slate-500">Ödeme yöntemini seçin:</p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" loading={saving} onClick={() => handleSell('cash')}>
                <Banknote className="h-4 w-4" /> Nakit
              </Button>
              <Button variant="outline" loading={saving} onClick={() => handleSell('card')}>
                <CreditCard className="h-4 w-4" /> Kart
              </Button>
              <Button variant="outline" loading={saving} onClick={() => handleSell('bank_transfer')}>
                <Building2 className="h-4 w-4" /> Havale
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
