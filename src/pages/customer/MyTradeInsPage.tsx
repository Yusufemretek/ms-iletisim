import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, ArrowRight, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime } from '@/lib/format';
import { navigate } from '@/lib/router';

interface TradeInRequest {
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
  photos: string[] | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'amber' | 'info' | 'success' | 'error' | 'default'; icon: typeof Clock }> = {
  PENDING: { label: 'Beklemede', variant: 'amber', icon: Clock },
  COUNTERED: { label: 'Karşı Teklif', variant: 'info', icon: RefreshCw },
  APPROVED: { label: 'Onaylandı', variant: 'success', icon: CheckCircle },
  REJECTED: { label: 'Reddedildi', variant: 'error', icon: XCircle },
  COMPLETED: { label: 'Tamamlandı', variant: 'success', icon: CheckCircle },
};

export function MyTradeInsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TradeInRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trade_ins')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setRequests((data as TradeInRequest[]) || []);
    setLoading(false);
  };

  const TRADE_HISTORY_STATUSES = ['COMPLETED', 'REJECTED', 'CANCELLED'];
  const activeRequests = requests.filter(r => !TRADE_HISTORY_STATUSES.includes(r.status));
  const historyRequests = requests.filter(r => TRADE_HISTORY_STATUSES.includes(r.status));

  const handleRespond = async (tradeId: string, accept: boolean) => {
    setSaving(true);
    await supabase.rpc('respond_trade_counter', {
      p_trade_id: tradeId,
      p_accept: accept,
    });
    setSaving(false);
    loadRequests();
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <RefreshCw className="h-6 w-6 text-cyan-500" />
            Takas Taleplerim
          </h1>
          <p className="mt-1 text-sm text-slate-500">Takas talepleriniz ve karşı teklifler</p>
        </div>
        <Button size="sm" onClick={() => navigate('/trade-in')}>
          Yeni Takas <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab switcher */}
      {!loading && requests.length > 0 && (
        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Aktif İşlemler
            {activeRequests.length > 0 && <span className="rounded-full bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-600">{activeRequests.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            İşlem Geçmişi
            {historyRequests.length > 0 && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{historyRequests.length}</span>}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <RefreshCw className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz takas talebiniz yok.</p>
          <Button className="mt-4" onClick={() => navigate('/trade-in')}>
            Takas Başlat
          </Button>
        </div>
      ) : activeTab === 'active' && activeRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Aktif takas talebiniz yok.</p>
          <Button className="mt-4" onClick={() => navigate('/trade-in')}>
            Yeni Takas
          </Button>
        </div>
      ) : activeTab === 'history' && historyRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz tamamlanan takas talebiniz yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(activeTab === 'active' ? activeRequests : historyRequests).map((r) => {
            const config = statusConfig[r.status] || statusConfig.PENDING;
            const Icon = config.icon;
            const isExpanded = expandedId === r.id;

            return (
              <div key={r.id} className="premium-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{r.trade_number}</p>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">{r.old_device_brand} {r.old_device_model} → {r.new_product_name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(r.created_at)}</p>
                  </div>
                  {r.counter_offer > 0 && r.status === 'COUNTERED' && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Karşı Teklif</p>
                      <p className="text-lg font-bold text-blue-600">{formatPrice(r.counter_offer)}</p>
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">Yeni Telefon:</span><span className="text-slate-800">{r.new_product_name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Yeni Fiyat:</span><span className="text-slate-800">{formatPrice(r.new_product_price)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Eski Cihaz:</span><span className="text-slate-800">{r.old_device_brand} {r.old_device_model}</span></div>
                      {r.old_device_condition && <div className="flex justify-between"><span className="text-slate-400">Durum:</span><span className="text-slate-800">{r.old_device_condition}</span></div>}
                      {r.old_device_imei && <div className="flex justify-between"><span className="text-slate-400">IMEI:</span><span className="text-slate-800 font-mono">{r.old_device_imei}</span></div>}
                      <div className="flex justify-between"><span className="text-slate-400">Müşteri Teklifi:</span><span className="text-slate-800">{formatPrice(r.old_device_offer)}</span></div>
                      <div className="flex justify-between font-bold"><span className="text-slate-700">Kalan Tutar:</span><span className="text-electric-600">{formatPrice(r.remaining_amount)}</span></div>
                    </div>

                    {r.photos && r.photos.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <ImageIcon className="h-4 w-4" /> Fotoğraflar
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {r.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                              <img src={url} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.status === 'COUNTERED' && r.counter_offer > 0 && (
                      <div className="mt-3 rounded-xl bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-700">Mağazadan Karşı Teklif</p>
                        <p className="mt-1 text-2xl font-bold text-blue-700">{formatPrice(r.counter_offer)}</p>
                        {r.counter_notes && <p className="mt-1 text-sm text-blue-600">Not: {r.counter_notes}</p>}
                        <p className="mt-1 text-xs text-blue-500">Kalan tutar: {formatPrice(r.new_product_price - r.counter_offer)}</p>
                        <div className="mt-3 flex gap-2">
                          <Button variant="success" size="sm" loading={saving} onClick={() => handleRespond(r.id, true)}>
                            <CheckCircle className="h-4 w-4" /> Kabul Et
                          </Button>
                          <Button variant="danger" size="sm" loading={saving} onClick={() => handleRespond(r.id, false)}>
                            <XCircle className="h-4 w-4" /> Reddet
                          </Button>
                        </div>
                      </div>
                    )}

                    {r.status === 'PENDING' && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>Takas talebiniz inceleniyor. En kısa sürede dönüş yapacağız.</span>
                      </div>
                    )}
                    {r.status === 'APPROVED' && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>Takasınız onaylandı. Mağazamızı arayarak işlemi tamamlayabilirsiniz.</span>
                      </div>
                    )}
                    {r.status === 'REJECTED' && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Üzgünüz, bu takas talebi reddedildi.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
