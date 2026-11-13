import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Search, CheckCircle, X, ImageIcon, MapPin, Truck, Phone, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime } from '@/lib/format';
import { trError } from '@/lib/errors';

interface SellRequest {
  id: string;
  request_number: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  battery_health: string | null;
  cosmetic_condition: string | null;
  screen_condition: string | null;
  changed_parts: string | null;
  imei: string | null;
  offer_price: number | null;
  status: string;
  customer_name: string;
  customer_phone: string | null;
  admin_notes: string | null;
  photos: string[] | null;
  created_at: string;
  pickup_preference: string | null;
  pickup_address: string | null;
  pickup_phone: string | null;
  pickup_date: string | null;
  pickup_slot: string | null;
}

export function AdminSellPhonePage() {
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<SellRequest | null>(null);
  const [offerPrice, setOfferPrice] = useState(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('sell_phone_requests').select('*').order('created_at', { ascending: false });
    setRequests((data as SellRequest[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return r.request_number.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q) || r.model.toLowerCase().includes(q) || (r.imei || '').includes(q);
    }
    return true;
  });

  const handleOffer = async (status: string) => {
    if (!selected) return;
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('update_sell_phone_offer', {
      p_request_id: selected.id,
      p_offer_price: offerPrice,
      p_status: status,
      p_admin_notes: adminNotes || null,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setSelected(null);
    load();
  };

  const statusVariant = (status: string): 'default' | 'info' | 'success' | 'amber' | 'error' => {
    switch (status) {
      case 'PENDING': return 'amber';
      case 'OFFERED': return 'info';
      case 'ACCEPTED': return 'success';
      case 'REJECTED': return 'error';
      case 'COMPLETED': return 'success';
      default: return 'default';
    }
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Beklemede', OFFERED: 'Teklif Verildi', ACCEPTED: 'Kabul Edildi', REJECTED: 'Reddedildi', COMPLETED: 'Tamamlandı',
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <TrendingUp className="h-6 w-6 text-purple-500" /> Telefon Satış Talepleri
        </h1>
        <p className="mt-1 text-sm text-slate-500">Müşteri telefon satış talepleri ve teklifler</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none">
          <option value="all">Tüm Durumlar</option>
          <option value="PENDING">Beklemede</option>
          <option value="OFFERED">Teklif Verildi</option>
          <option value="ACCEPTED">Kabul Edildi</option>
          <option value="REJECTED">Reddedildi</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Talep yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="premium-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-500">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{r.request_number}</p>
                      <Badge variant={statusVariant(r.status)}>{statusLabels[r.status] || r.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{r.brand} {r.model} {r.storage} {r.color}</p>
                    <p className="text-xs text-slate-400">{r.customer_name} {r.customer_phone && `• ${r.customer_phone}`}</p>
                    {r.pickup_preference === 'EVDEN_ALIM' && (
                      <div className="mt-2 rounded-lg bg-amber-50 p-2">
                        <p className="flex items-center gap-1 text-xs font-semibold text-amber-700"><Truck className="h-3.5 w-3.5" /> Evden Alım Talebi</p>
                        {r.pickup_address && <p className="mt-1 flex items-start gap-1 text-xs text-amber-600"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {r.pickup_address}</p>}
                        {r.pickup_phone && <p className="flex items-center gap-1 text-xs text-amber-600"><Phone className="h-3 w-3" /> {r.pickup_phone}</p>}
                        {r.pickup_date && <p className="flex items-center gap-1 text-xs text-amber-600"><Calendar className="h-3 w-3" /> {r.pickup_date}</p>}
                      </div>
                    )}
                    {r.offer_price && <p className="text-sm font-bold text-electric-600">Teklif: {formatPrice(r.offer_price)}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatDateTime(r.created_at)}</p>
                </div>
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => { setSelected(r); setOfferPrice(r.offer_price || 0); setAdminNotes(r.admin_notes || ''); }}>
                  {r.status === 'PENDING' ? 'Teklif Ver' : 'Detay'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Offer Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{selected.request_number}</h2>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-900">{selected.brand} {selected.model}</p>
              <p className="text-slate-500">{selected.storage} • {selected.color}</p>
              {selected.battery_health && <p className="text-slate-500">Pil: {selected.battery_health}%</p>}
              {selected.cosmetic_condition && <p className="text-slate-500">Kozmetik: {selected.cosmetic_condition}</p>}
              {selected.screen_condition && <p className="text-slate-500">Ekran: {selected.screen_condition}</p>}
              {selected.changed_parts && <p className="text-slate-500">Değişen: {selected.changed_parts}</p>}
              {selected.imei && <p className="text-slate-500">IMEI: {selected.imei}</p>}
            </div>
            {selected.photos && selected.photos.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><ImageIcon className="h-4 w-4" /> Cihaz Fotoğrafları</p>
                <div className="flex flex-wrap gap-2">
                  {selected.photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                      <img src={url} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <Input label="Teklif Tutarı (₺)" type="number" min={0} value={offerPrice} onChange={(e) => setOfferPrice(Number(e.target.value))} />
            <Textarea label="Admin Notları" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} />
            <div className="mt-4 flex gap-2">
              <Button variant="danger" className="flex-1" loading={saving} onClick={() => handleOffer('REJECTED')}>
                <X className="h-4 w-4" /> Reddet
              </Button>
              <Button className="flex-1" loading={saving} onClick={() => handleOffer('OFFERED')}>
                <CheckCircle className="h-4 w-4" /> Teklif Gönder
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
