import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, CheckCircle, X, ImageIcon, ArrowRight, MapPin, Truck, Phone, Calendar, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime } from '@/lib/format';
import { trError } from '@/lib/errors';

interface TradeIn {
  id: string;
  trade_number: string;
  new_product_name: string;
  new_product_price: number;
  old_device_brand: string;
  old_device_model: string;
  old_device_imei: string | null;
  old_device_offer: number;
  old_device_condition: string | null;
  counter_offer: number;
  counter_notes: string | null;
  remaining_amount: number;
  status: string;
  customer_name: string;
  admin_notes: string | null;
  photos: string[] | null;
  created_at: string;
  pickup_requested: boolean | null;
  pickup_address: string | null;
  pickup_phone: string | null;
  pickup_date: string | null;
  pickup_slot: string | null;
}

export function AdminTradeInsPage() {
  const [trades, setTrades] = useState<TradeIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [counterTradeId, setCounterTradeId] = useState<string | null>(null);
  const [counterOffer, setCounterOffer] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('trade_ins').select('*').order('created_at', { ascending: false });
    setTrades((data as TradeIn[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = trades.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.trade_number.toLowerCase().includes(q) || t.old_device_brand.toLowerCase().includes(q) || t.old_device_model.toLowerCase().includes(q);
    }
    return true;
  });

  // Onaylanan (müşteri kabul etti / admin onayladı) takaslar pasif kabul edilir ve geçmişe taşınır
  const TRADE_HISTORY_STATUSES = ['APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
  const activeTrades = filtered.filter(t => !TRADE_HISTORY_STATUSES.includes(t.status));
  const historyTrades = filtered.filter(t => TRADE_HISTORY_STATUSES.includes(t.status));

  const handleApprove = async (tradeId: string, approved: boolean) => {
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('approve_trade_in', {
      p_trade_id: tradeId,
      p_approved: approved,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    load();
  };

  const handleComplete = async (tradeId: string) => {
    setError('');
    setSaving(true);
    const { error: err } = await supabase.from('trade_ins').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('id', tradeId);
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    load();
  };

  const handleCounter = async (tradeId: string) => {
    const offer = Number(counterOffer);
    if (!offer || offer <= 0) { setError('Geçerli bir teklif girin'); return; }
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('counter_trade_in', {
      p_trade_id: tradeId,
      p_counter_offer: offer,
      p_counter_notes: counterNotes || null,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setCounterTradeId(null);
    setCounterOffer('');
    setCounterNotes('');
    load();
  };

  const openCounter = (t: TradeIn) => {
    setCounterTradeId(t.id);
    setCounterOffer(String(t.counter_offer || t.old_device_offer || ''));
    setCounterNotes(t.counter_notes || '');
  };

  const statusVariant = (status: string): 'default' | 'info' | 'success' | 'amber' | 'error' => {
    switch (status) {
      case 'PENDING': return 'amber';
      case 'COUNTERED': return 'info';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      case 'COMPLETED': return 'success';
      default: return 'default';
    }
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Beklemede', COUNTERED: 'Karşı Teklif', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal Edildi',
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <RefreshCw className="h-6 w-6 text-cyan-500" /> Takas İşlemleri
        </h1>
        <p className="mt-1 text-sm text-slate-500">Müşteri takas talepleri ve karşı teklifler</p>
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
          <option value="COUNTERED">Karşı Teklif</option>
          <option value="APPROVED">Onaylandı</option>
          <option value="REJECTED">Reddedildi</option>
          <option value="COMPLETED">Tamamlandı</option>
        </select>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button onClick={() => setActiveTab('active')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            Aktif İşlemler
            {activeTrades.length > 0 && <span className="rounded-full bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-600">{activeTrades.length}</span>}
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            İşlem Geçmişi
            {historyTrades.length > 0 && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{historyTrades.length}</span>}
          </button>
        </div>
      )}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <RefreshCw className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Takas talebi yok.</p>
        </div>
      ) : activeTab === 'active' && activeTrades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-sm text-slate-500">Aktif takas kaydı yok.</p></div>
      ) : activeTab === 'history' && historyTrades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-sm text-slate-500">İşlem geçmişi boş.</p></div>
      ) : (
        <div className="space-y-3">
          {(activeTab === 'active' ? activeTrades : historyTrades).map(t => (
            <div key={t.id} className="premium-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-500">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{t.trade_number}</p>
                      <Badge variant={statusVariant(t.status)}>{statusLabels[t.status] || t.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">Yeni: {t.new_product_name}</p>
                    <p className="text-xs text-slate-400">Eski: {t.old_device_brand} {t.old_device_model}</p>
                    {t.old_device_condition && <p className="text-xs text-slate-400">Durum: {t.old_device_condition}</p>}
                    {t.old_device_imei && <p className="text-xs text-slate-400">IMEI: {t.old_device_imei}</p>}
                    <p className="text-xs text-slate-400">{t.customer_name}</p>
                    {t.pickup_requested && (
                      <div className="mt-2 rounded-lg bg-amber-50 p-2">
                        <p className="flex items-center gap-1 text-xs font-semibold text-amber-700"><Truck className="h-3.5 w-3.5" /> Evden Alım Talebi</p>
                        {t.pickup_address && <p className="mt-1 flex items-start gap-1 text-xs text-amber-600"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {t.pickup_address}</p>}
                        {t.pickup_phone && <p className="flex items-center gap-1 text-xs text-amber-600"><Phone className="h-3 w-3" /> {t.pickup_phone}</p>}
                        {t.pickup_date && <p className="flex items-center gap-1 text-xs text-amber-600"><Calendar className="h-3 w-3" /> {t.pickup_date}</p>}
                      </div>
                    )}
                    {t.photos && t.photos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.photos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200">
                            <img src={url} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatDateTime(t.created_at)}</p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <p className="text-slate-500">Yeni: {formatPrice(t.new_product_price)}</p>
                    <p className="text-emerald-600">Müşteri Teklif: {formatPrice(t.old_device_offer)}</p>
                    {t.counter_offer > 0 && t.status === 'COUNTERED' && (
                      <p className="font-medium text-blue-600">Karşı Teklif: {formatPrice(t.counter_offer)}</p>
                    )}
                    <p className="font-bold text-electric-600">Kalan: {formatPrice(t.remaining_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Counter-offer form */}
              {counterTradeId === t.id && (t.status === 'PENDING' || t.status === 'COUNTERED') && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-700">Karşı Teklif Gönder</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={0}
                      value={counterOffer}
                      onChange={(e) => setCounterOffer(e.target.value)}
                      placeholder="Teklif tutarı (TL)"
                      className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={counterNotes}
                      onChange={(e) => setCounterNotes(e.target.value)}
                      placeholder="Not (opsiyonel)"
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" loading={saving} onClick={() => handleCounter(t.id)}>
                      <ArrowRight className="h-3.5 w-3.5" /> Gönder
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setCounterTradeId(null); setCounterOffer(''); setCounterNotes(''); }}>
                      İptal
                    </Button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {t.status === 'PENDING' && counterTradeId !== t.id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="danger" size="sm" loading={saving} onClick={() => handleApprove(t.id, false)}>
                    <X className="h-3.5 w-3.5" /> Reddet
                  </Button>
                  <Button variant="success" size="sm" loading={saving} onClick={() => handleApprove(t.id, true)}>
                    <CheckCircle className="h-3.5 w-3.5" /> Onayla
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openCounter(t)}>
                    <ArrowRight className="h-3.5 w-3.5" /> Karşı Teklif
                  </Button>
                </div>
              )}

              {t.status === 'COUNTERED' && counterTradeId !== t.id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="danger" size="sm" loading={saving} onClick={() => handleApprove(t.id, false)}>
                    <X className="h-3.5 w-3.5" /> Reddet
                  </Button>
                  <Button variant="success" size="sm" loading={saving} onClick={() => handleApprove(t.id, true)}>
                    <CheckCircle className="h-3.5 w-3.5" /> Onayla
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openCounter(t)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Teklifi Güncelle
                  </Button>
                </div>
              )}

              {t.status === 'APPROVED' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {t.pickup_requested && (
                    <span className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700">
                      <Truck className="h-3.5 w-3.5" /> Kurye & Teslimat listesine eklendi
                    </span>
                  )}
                  <Button variant="outline" size="sm" loading={saving} onClick={() => handleComplete(t.id)}>
                    <CheckCircle className="h-3.5 w-3.5" /> Tamamlandı Olarak İşaretle
                  </Button>
                </div>
              )}

              {t.status === 'COUNTERED' && t.counter_notes && (
                <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Not: {t.counter_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
