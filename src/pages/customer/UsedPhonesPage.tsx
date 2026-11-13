import { useEffect, useState } from 'react';
import { Smartphone, Search, Recycle, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import { navigate, getNavSeq } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/Button';
import type { ProductWithImages } from '@/lib/types';

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
  used_device_images: { id: string; image_url: string }[];
}

export function UsedPhonesPage() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [devices, setDevices] = useState<UsedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<UsedDevice | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    const mySeq = getNavSeq();
    const [usedDevRes, productsRes] = await Promise.all([
      supabase
        .from('used_devices')
        .select('*, used_device_images(*)')
        .eq('status', 'available')
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('is_active', true)
        .eq('type', 'used_phone')
        .order('created_at', { ascending: false }),
    ]);
    if (getNavSeq() !== mySeq) return;

    const fromUsedDevices: UsedDevice[] = ((usedDevRes.data as UsedDevice[]) || []).map(d => ({
      ...d,
      used_device_images: d.used_device_images || [],
    }));

    const fromProducts: UsedDevice[] = ((productsRes.data as ProductWithImages[]) || []).map(p => ({
      id: p.id,
      brand: p.brand || '',
      model: p.model || p.name,
      storage: p.memory || null,
      color: p.color || null,
      imei: p.imei || null,
      battery_health: p.battery_health || null,
      cosmetic_grade: p.cosmetic_condition || null,
      screen_condition: null,
      body_condition: null,
      camera_condition: null,
      face_id_status: null,
      touch_id_status: null,
      original_screen: true,
      changed_parts: null,
      warranty_status: p.warranty_status || null,
      purchase_price: 0,
      sale_price: p.sale_price,
      status: 'available',
      description: p.description || null,
      used_device_images: (p.product_images || []).map(img => ({ id: img.id, image_url: img.image_url })),
    }));

    const combined = [...fromUsedDevices, ...fromProducts];
    setDevices(combined);
    setLoading(false);
  };

  const brands = [...new Set(devices.map(d => d.brand))];

  const filtered = devices.filter(d => {
    if (brandFilter !== 'all' && d.brand !== brandFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return d.brand.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        (d.imei || '').includes(q);
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Recycle className="h-6 w-6 text-emerald-600" />
          2. El Telefonlar
        </h1>
        <p className="mt-1 text-sm text-slate-500">Her cihaz tek tek ekspertiz edilmiştir</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Marka, model veya IMEI ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark w-full py-2.5 pl-10 pr-3 text-sm"
          />
        </div>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="input-dark px-3 py-2.5 text-sm"
        >
          <option value="all">Tüm Markalar</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-white" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <Smartphone className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">Şu anda 2. el telefon bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map(device => (
            <button
              key={device.id}
              onClick={() => setSelectedDevice(device)}
              className="premium-card group overflow-hidden text-left"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-50">
                {device.used_device_images?.[0] ? (
                  <img src={device.used_device_images[0].image_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Smartphone className="h-12 w-12 text-slate-300" />
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">2. EL</span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-400">{device.brand}</p>
                <h3 className="truncate text-sm font-semibold text-slate-800">{device.model}</h3>
                {device.storage && <p className="text-xs text-slate-400">{device.storage} • {device.color}</p>}
                <p className="mt-2 text-base font-bold text-electric-600">{formatPrice(device.sale_price)}</p>
                {device.battery_health && <p className="text-xs text-emerald-600">Pil: {device.battery_health}%</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedDevice(null)} />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{selectedDevice.brand} {selectedDevice.model}</h2>
              <button onClick={() => setSelectedDevice(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Images */}
            {selectedDevice.used_device_images && selectedDevice.used_device_images.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                {selectedDevice.used_device_images.map(img => (
                  <div key={img.id} className="aspect-square overflow-hidden rounded-xl bg-slate-50">
                    <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Specs */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              {selectedDevice.storage && <SpecItem label="Hafıza" value={selectedDevice.storage} />}
              {selectedDevice.color && <SpecItem label="Renk" value={selectedDevice.color} />}
              {selectedDevice.battery_health && <SpecItem label="Pil Sağlığı" value={`${selectedDevice.battery_health}%`} />}
              {selectedDevice.cosmetic_grade && <SpecItem label="Kozmetik" value={selectedDevice.cosmetic_grade} />}
              {selectedDevice.screen_condition && <SpecItem label="Ekran" value={selectedDevice.screen_condition} />}
              {selectedDevice.body_condition && <SpecItem label="Kasa" value={selectedDevice.body_condition} />}
              {selectedDevice.camera_condition && <SpecItem label="Kamera" value={selectedDevice.camera_condition} />}
              {selectedDevice.face_id_status && <SpecItem label="Face ID" value={selectedDevice.face_id_status} />}
              {selectedDevice.touch_id_status && <SpecItem label="Touch ID" value={selectedDevice.touch_id_status} />}
              <SpecItem label="Orijinal Ekran" value={selectedDevice.original_screen ? 'Evet' : 'Hayır'} />
              {selectedDevice.warranty_status && <SpecItem label="Garanti" value={selectedDevice.warranty_status} />}
            </div>

            {selectedDevice.changed_parts && (
              <div className="mb-4 rounded-xl bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-500">Değişen Parçalar</p>
                <p className="text-sm text-slate-600">{selectedDevice.changed_parts}</p>
              </div>
            )}

            {selectedDevice.description && (
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-500">Açıklama</p>
                <p className="text-sm text-slate-600">{selectedDevice.description}</p>
              </div>
            )}

            {selectedDevice.imei && (
              <div className="mb-4 rounded-xl bg-electric-50 p-3">
                <p className="text-xs text-electric-600">IMEI</p>
                <p className="font-mono text-sm font-semibold text-electric-600">
                  {selectedDevice.imei.slice(0, 4)}•••••••{selectedDevice.imei.slice(-2)}
                </p>
              </div>
            )}

            <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <span className="text-sm text-slate-500">Satış Fiyatı</span>
              <span className="text-2xl font-bold text-electric-600">{formatPrice(selectedDevice.sale_price)}</span>
            </div>

            <Button className="w-full" size="lg" onClick={() => {
              if (!user) { navigate('/login'); return; }
              if (selectedDevice) {
                addItem({
                  product_id: selectedDevice.id,
                  name: `${selectedDevice.brand} ${selectedDevice.model}`,
                  brand: selectedDevice.brand,
                  model: selectedDevice.model,
                  unit_price: selectedDevice.sale_price,
                  quantity: 1,
                  stock: 1,
                  image_url: selectedDevice.used_device_images?.[0]?.image_url || null,
                  type: 'used_phone',
                  imei: selectedDevice.imei || null,
                });
              }
              navigate('/cart');
            }}>
              <CheckCircle className="h-4 w-4" />
              Sepete Ekle
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-600">{value}</p>
    </div>
  );
}
