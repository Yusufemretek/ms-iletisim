import { useEffect, useState, useCallback } from 'react';
import { Truck, Search, MapPin, Phone, Clock, CheckCircle, X, User, Banknote, Package, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime, DELIVERY_STATUS_LABELS } from '@/lib/format';
import type { Delivery, DeliveryStatus, DeliverySlot, Order, OrderItem } from '@/lib/types';
import { trError } from '@/lib/errors';

function deliveryTitle(d: Delivery & { orders?: Order | null }): string {
  if (d.orders?.order_number) return d.orders.order_number;
  if (d.title) return d.title;
  if (d.source_type === 'TRADE_IN') return 'Takas — Evden Alım';
  if (d.source_type === 'SERVICE') return 'Teknik Servis — Evden Alım';
  return 'Sipariş';
}

export function AdminDeliveriesPageNew() {
  const [deliveries, setDeliveries] = useState<(Delivery & { orders?: Order & { order_items?: OrderItem[] } })[]>([]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showDetail, setShowDetail] = useState<(Delivery & { orders?: Order & { order_items?: OrderItem[] } }) | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Slot form
  const [slotLabel, setSlotLabel] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');

  // Delivery detail
  const [collectedAmount, setCollectedAmount] = useState(0);
  const [courierId, setCourierId] = useState('');

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deliveries')
      .select('*, orders(*, order_items(*))')
      .order('created_at', { ascending: false });
    setDeliveries((data as (Delivery & { orders?: Order & { order_items?: OrderItem[] } })[]) || []);
    setLoading(false);
  }, []);

  const loadSlots = useCallback(async () => {
    const { data } = await supabase.from('delivery_slots').select('*').order('sort_order');
    setSlots((data as DeliverySlot[]) || []);
  }, []);

  useEffect(() => {
    loadDeliveries();
    loadSlots();
  }, [loadDeliveries, loadSlots]);

  const filtered = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (d.orders?.order_number || '').toLowerCase().includes(q) ||
        (d.orders?.customer_name || d.customer_name || '').toLowerCase().includes(q) ||
        (d.title || '').toLowerCase().includes(q) ||
        (d.address || '').toLowerCase().includes(q);
    }
    return true;
  });

  const statusVariant = (status: DeliveryStatus): 'default' | 'info' | 'success' | 'amber' | 'error' => {
    switch (status) {
      case 'PENDING': return 'amber';
      case 'ASSIGNED': return 'info';
      case 'PICKED_UP': return 'info';
      case 'OUT_FOR_DELIVERY': return 'info';
      case 'DELIVERED': return 'success';
      case 'FAILED': return 'error';
      case 'RETURNED': return 'error';
      default: return 'default';
    }
  };

  const handleAddSlot = async () => {
    setError('');
    if (!slotLabel.trim() || !slotStart || !slotEnd) { setError('Tüm alanları doldurun'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('delivery_slots').insert({
      label: slotLabel,
      start_time: slotStart,
      end_time: slotEnd,
      sort_order: slots.length + 1,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setShowSlotModal(false);
    setSlotLabel(''); setSlotStart(''); setSlotEnd('');
    loadSlots();
  };

  const handleAssignCourier = async () => {
    if (!showDetail) return;
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('assign_courier_delivery', {
      p_delivery_id: showDetail.id,
      p_courier_id: courierId || null,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    loadDeliveries();
    setShowDetail(null);
  };

  const handleUpdateStatus = async (delivery: Delivery, status: DeliveryStatus, collected: number = 0) => {
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('update_delivery_status', {
      p_delivery_id: delivery.id,
      p_status: status,
      p_collected_amount: collected,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    loadDeliveries();
    setShowDetail(null);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kurye & Teslimat</h1>
          <p className="mt-1 text-sm text-slate-500">Kurye teslimatları ve saat aralıkları</p>
        </div>
        <Button variant="outline" onClick={() => setShowSlotModal(true)}>
          <Clock className="h-4 w-4" /> Saat Aralıkları
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Saat aralıkları özet */}
      <div className="mb-4 flex flex-wrap gap-2">
        {slots.map(s => (
          <span key={s.id} className={`rounded-lg px-3 py-1 text-xs font-medium ${s.is_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
            {s.label}
          </span>
        ))}
      </div>

      {/* Filtreler */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Sipariş no veya müşteri ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="all">Tüm Durumlar</option>
          {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map(s => (
            <option key={s} value={s}>{DELIVERY_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Teslimat listesi */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Truck className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Teslimat kaydı yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(delivery => (
            <div key={delivery.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{deliveryTitle(delivery)}</p>
                      {delivery.source_type && delivery.source_type !== 'ORDER' && (
                        <Badge variant="amber">{delivery.source_type === 'TRADE_IN' ? 'Takas Alımı' : 'Servis Alımı'}</Badge>
                      )}
                      <Badge variant={statusVariant(delivery.status)}>{DELIVERY_STATUS_LABELS[delivery.status as DeliveryStatus] || delivery.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{delivery.orders?.customer_name || delivery.customer_name}</p>
                    {!delivery.orders && delivery.notes && <p className="text-xs text-slate-500">{delivery.notes}</p>}
                    {delivery.address && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {delivery.address}
                      </p>
                    )}
                    {delivery.phone && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {delivery.phone}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">{formatDateTime(delivery.created_at)}</p>
                    {delivery.orders?.order_items && delivery.orders.order_items.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {delivery.orders.order_items.map((item) => (
                          <span key={item.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            <Package className="h-3 w-3" /> {item.product_name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {delivery.orders && <p className="text-sm font-bold text-slate-900">{formatPrice(delivery.orders.total)}</p>}
                  {delivery.collected_amount > 0 && <p className="text-xs text-emerald-600">Tahsil: {formatPrice(delivery.collected_amount)}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowDetail(delivery); setCollectedAmount(delivery.orders?.total || 0); setCourierId(delivery.courier_id || ''); }}>
                  Detay
                </Button>
                {delivery.status === 'PENDING' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(delivery, 'ASSIGNED')}>Ata</Button>
                )}
                {delivery.status === 'ASSIGNED' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(delivery, 'PICKED_UP')}>Teslim Alındı</Button>
                )}
                {delivery.status === 'PICKED_UP' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(delivery, 'OUT_FOR_DELIVERY')}>Dağıtıma Çık</Button>
                )}
                {delivery.status === 'OUT_FOR_DELIVERY' && (
                  <>
                    <Button variant="success" size="sm" onClick={() => handleUpdateStatus(delivery, 'DELIVERED', delivery.orders ? collectedAmount : 0)}>
                      <CheckCircle className="h-3.5 w-3.5" /> Teslim Et
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleUpdateStatus(delivery, 'FAILED')}>
                      <X className="h-3.5 w-3.5" /> Başarısız
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slot Modal */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSlotModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Saat Aralıkları</h2>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="mb-4 space-y-2">
              {slots.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-2">
                  <span className="text-sm font-medium">{s.label}</span>
                  <Badge variant={s.is_active ? 'success' : 'default'}>{s.is_active ? 'Aktif' : 'Pasif'}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <Input label="Etiket" value={slotLabel} onChange={(e) => setSlotLabel(e.target.value)} placeholder="10:00 - 12:00" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Başlangıç" type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
                <Input label="Bitiş" type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSlotModal(false)}>Kapat</Button>
              <Button className="flex-1" loading={saving} onClick={handleAddSlot}>Ekle</Button>
            </div>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDetail(null)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Teslimat Detayı</h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">{showDetail.orders ? 'Sipariş No' : 'Kayıt'}</p>
                  <p className="font-medium text-slate-900">{deliveryTitle(showDetail)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Müşteri</p>
                  <p className="font-medium text-slate-900">{showDetail.orders?.customer_name || showDetail.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Telefon</p>
                  <p className="font-medium text-slate-900">{showDetail.phone || showDetail.orders?.customer_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Durum</p>
                  <Badge variant={statusVariant(showDetail.status)}>{DELIVERY_STATUS_LABELS[showDetail.status as DeliveryStatus] || showDetail.status}</Badge>
                </div>
              </div>
              {showDetail.address && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">Adres</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(showDetail.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      <Navigation className="h-3 w-3" /> Yol Tarifi
                    </a>
                  </div>
                  <p className="text-slate-700">{showDetail.address}</p>
                </div>
              )}
              {showDetail.orders?.order_items && showDetail.orders.order_items.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-400">TESLİMAT EDİLECEK ÜRÜNLER</p>
                  <div className="space-y-2">
                    {showDetail.orders.order_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                            {item.brand && <p className="text-xs text-slate-500">{item.brand} {item.model}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{item.quantity} adet</p>
                          <p className="text-xs text-slate-500">{formatPrice(item.unit_price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {showDetail.notes && (
                <div>
                  <p className="text-xs text-slate-400">Notlar</p>
                  <p className="text-slate-700">{showDetail.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">Kurye ID</p>
                <Input value={courierId} onChange={(e) => setCourierId(e.target.value)} placeholder="Kurye kullanıcı ID (opsiyonel)" />
              </div>
              <Button variant="outline" className="w-full" onClick={handleAssignCourier} loading={saving}>
                <User className="h-4 w-4" /> Kurye Ata
              </Button>
              {showDetail.status === 'OUT_FOR_DELIVERY' && showDetail.orders && (
                <div className="border-t border-slate-100 pt-3">
                  <Input label="Tahsil Edilen Tutar (₺)" type="number" min={0} value={collectedAmount} onChange={(e) => setCollectedAmount(Number(e.target.value))} />
                  <Button variant="success" className="mt-2 w-full" onClick={() => handleUpdateStatus(showDetail, 'DELIVERED', collectedAmount)} loading={saving}>
                    <Banknote className="h-4 w-4" /> Teslim Et ve Tahsil Et
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
