import { useEffect, useState } from 'react';
import { TrendingUp, CheckCircle, XCircle, Clock, ArrowRight, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime } from '@/lib/format';
import { navigate } from '@/lib/router';

interface SellPhoneRequest {
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
  photos: string[] | null;
  offer_price: number | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'amber' | 'info' | 'success' | 'error' | 'default'; icon: typeof Clock }> = {
  PENDING: { label: 'Beklemede', variant: 'amber', icon: Clock },
  OFFERED: { label: 'Teklif Verildi', variant: 'info', icon: CheckCircle },
  ACCEPTED: { label: 'Kabul Edildi', variant: 'success', icon: CheckCircle },
  REJECTED: { label: 'Reddedildi', variant: 'error', icon: XCircle },
  COMPLETED: { label: 'Tamamlandı', variant: 'success', icon: CheckCircle },
};

export function MySellPhoneRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SellPhoneRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      .from('sell_phone_requests')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setRequests((data as SellPhoneRequest[]) || []);
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <TrendingUp className="h-6 w-6 text-violet-500" />
            Satış Taleplerim
          </h1>
          <p className="mt-1 text-sm text-slate-500">Telefon satış talepleriniz ve teklifler</p>
        </div>
        <Button size="sm" onClick={() => navigate('/sell-phone')}>
          Yeni Talep <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz satış talebiniz yok.</p>
          <Button className="mt-4" onClick={() => navigate('/sell-phone')}>
            Telefonunu Sat
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const config = statusConfig[r.status] || statusConfig.PENDING;
            const Icon = config.icon;
            const isExpanded = expandedId === r.id;

            return (
              <div key={r.id} className="premium-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{r.request_number}</p>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">{r.brand} {r.model} {r.storage} {r.color}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(r.created_at)}</p>
                  </div>
                  {r.offer_price && r.offer_price > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Teklif</p>
                      <p className="text-lg font-bold text-electric-600">{formatPrice(r.offer_price)}</p>
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4">
                    <div className="space-y-1.5 text-sm">
                      {r.storage && <div className="flex justify-between"><span className="text-slate-400">Hafıza:</span><span className="text-slate-800">{r.storage}</span></div>}
                      {r.color && <div className="flex justify-between"><span className="text-slate-400">Renk:</span><span className="text-slate-800">{r.color}</span></div>}
                      {r.battery_health && <div className="flex justify-between"><span className="text-slate-400">Pil Sağlığı:</span><span className="text-slate-800">{r.battery_health}%</span></div>}
                      {r.cosmetic_condition && <div className="flex justify-between"><span className="text-slate-400">Kozmetik:</span><span className="text-slate-800">{r.cosmetic_condition}</span></div>}
                      {r.screen_condition && <div className="flex justify-between"><span className="text-slate-400">Ekran:</span><span className="text-slate-800">{r.screen_condition}</span></div>}
                      {r.changed_parts && <div className="flex justify-between"><span className="text-slate-400">Değişen Parçalar:</span><span className="text-slate-800">{r.changed_parts}</span></div>}
                      {r.imei && <div className="flex justify-between"><span className="text-slate-400">IMEI:</span><span className="text-slate-800 font-mono">{r.imei}</span></div>}
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

                    {r.offer_price && r.offer_price > 0 && (
                      <div className="mt-3 rounded-xl bg-emerald-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-emerald-700">Teklif Tutarı</span>
                          <span className="text-xl font-bold text-emerald-700">{formatPrice(r.offer_price)}</span>
                        </div>
                      </div>
                    )}

                    {r.admin_notes && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-500">Mağaza Notu</p>
                        <p className="mt-1 text-sm text-slate-700">{r.admin_notes}</p>
                      </div>
                    )}

                    {r.status === 'OFFERED' && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>Teklifiniz hazır. Mağazamızı arayarak teklifi kabul veya reddebilirsiniz.</span>
                      </div>
                    )}
                    {r.status === 'REJECTED' && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Üzgünüz, bu cihaz için teklif verilemedi.</span>
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
