import { useEffect, useState, useCallback } from 'react';
import { Wrench, Search, Smartphone, CheckCircle, X, Banknote, Plus, Trash2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime, SERVICE_STATUS_LABELS } from '@/lib/format';
import type { ServiceRecord, ServiceStatus } from '@/lib/types';
import { trError } from '@/lib/errors';

interface QuoteOption {
  option_name: string;
  service_price: number;
  parts_cost: number;
  labor_cost: number;
}

export function AdminServicePage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDetail, setShowDetail] = useState<ServiceRecord | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Quote form
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([{ option_name: '', service_price: 0, parts_cost: 0, labor_cost: 0 }]);
  const [quoteNotes, setQuoteNotes] = useState('');

  // Payment form
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const loadServices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('service_records').select('*').order('created_at', { ascending: false });
    setServices((data as ServiceRecord[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const filtered = services.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.service_number.toLowerCase().includes(q) ||
        s.customer_name.toLowerCase().includes(q) ||
        (s.device_brand || '').toLowerCase().includes(q) ||
        (s.device_model || '').toLowerCase().includes(q) ||
        (s.imei || '').includes(q);
    }
    return true;
  });

  const SERVICE_HISTORY_STATUSES: ServiceStatus[] = ['COMPLETED', 'DELIVERED', 'PAID', 'REJECTED', 'CANCELLED'];
  const activeServices = filtered.filter(s => !SERVICE_HISTORY_STATUSES.includes(s.status));
  const historyServices = filtered.filter(s => SERVICE_HISTORY_STATUSES.includes(s.status));

  const statusVariant = (status: ServiceStatus): 'default' | 'info' | 'success' | 'amber' | 'error' => {
    switch (status) {
      case 'RECEIVED': return 'default';
      case 'QUOTED': return 'info';
      case 'APPROVED': return 'amber';
      case 'IN_PROGRESS': return 'info';
      case 'COMPLETED': return 'success';
      case 'DELIVERED': return 'success';
      case 'PAID': return 'success';
      case 'REJECTED':
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  const openQuote = (service: ServiceRecord) => {
    setShowDetail(service);
    setQuoteOptions([{ option_name: '', service_price: 0, parts_cost: 0, labor_cost: 0 }]);
    setQuoteNotes(service.notes || '');
    setShowQuoteModal(true);
  };

  const addOption = () => {
    setQuoteOptions([...quoteOptions, { option_name: '', service_price: 0, parts_cost: 0, labor_cost: 0 }]);
  };

  const removeOption = (index: number) => {
    if (quoteOptions.length <= 1) return;
    setQuoteOptions(quoteOptions.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: keyof QuoteOption, value: string | number) => {
    setQuoteOptions(quoteOptions.map((opt, i) => i === index ? { ...opt, [field]: value } : opt));
  };

  const handleSaveQuote = async () => {
    if (!showDetail) return;
    setError('');
    const validOptions = quoteOptions.filter(o => o.option_name.trim() && o.service_price > 0);
    if (validOptions.length === 0) {
      setError('En az bir geçerli teklif seçeneği giriniz (isim ve fiyat zorunlu).');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.rpc('update_service_status', {
      p_service_id: showDetail.id,
      p_status: 'QUOTED',
      p_service_price: validOptions[0].service_price,
      p_parts_cost: validOptions[0].parts_cost,
      p_labor_cost: validOptions[0].labor_cost,
      p_notes: quoteNotes || null,
      p_quote_options: validOptions,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setShowQuoteModal(false);
    loadServices();
  };

  const handleStatusChange = async (service: ServiceRecord, status: ServiceStatus) => {
    const { error: err } = await supabase.rpc('update_service_status', {
      p_service_id: service.id,
      p_status: status,
    });
    if (err) { setError(trError(err)); return; }
    loadServices();
  };

  const handlePayment = async () => {
    if (!showDetail) return;
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('create_service_sale', {
      p_service_id: showDetail.id,
      p_payment_method: paymentMethod,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setShowPaymentModal(false);
    loadServices();
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Teknik Servis</h1>
        <p className="mt-1 text-sm text-slate-500">Servis kayıtları ve tamir süreçleri</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Filtreler */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Servis no, müşteri, cihaz veya IMEI ara..."
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
          {(Object.keys(SERVICE_STATUS_LABELS) as ServiceStatus[]).map(s => (
            <option key={s} value={s}>{SERVICE_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Servis listesi */}
      {!loading && filtered.length > 0 && (
        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button onClick={() => setActiveTab('active')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            Aktif İşlemler
            {activeServices.length > 0 && <span className="rounded-full bg-electric-100 px-1.5 py-0.5 text-[10px] font-bold text-electric-600">{activeServices.length}</span>}
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            İşlem Geçmişi
            {historyServices.length > 0 && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{historyServices.length}</span>}
          </button>
        </div>
      )}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Wrench className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Servis kaydı yok.</p>
        </div>
      ) : activeTab === 'active' && activeServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-sm text-slate-500">Aktif servis kaydı yok.</p></div>
      ) : activeTab === 'history' && historyServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-sm text-slate-500">İşlem geçmişi boş.</p></div>
      ) : (
        <div className="space-y-3">
          {(activeTab === 'active' ? activeServices : historyServices).map(service => {
            const profit = service.service_price - service.parts_cost - service.labor_cost;
            return (
              <div key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{service.service_number}</p>
                        <Badge variant={statusVariant(service.status)}>{SERVICE_STATUS_LABELS[service.status]}</Badge>
                      </div>
                      <p className="text-sm text-slate-600">{service.customer_name} {service.customer_phone && `• ${service.customer_phone}`}</p>
                      <p className="text-xs text-slate-400">
                        {service.device_brand} {service.device_model}
                        {service.imei && ` • IMEI: ${service.imei}`}
                        {service.pickup_requested && ' • Adresten Alınacak'}
                      </p>
                      {service.issue_description && (
                        <p className="mt-1 text-xs text-slate-500">Arıza: {service.issue_description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{formatDateTime(service.created_at)}</p>
                    {service.service_price > 0 && (
                      <>
                        <p className="text-sm font-bold text-slate-900">{formatPrice(service.service_price)}</p>
                        <p className="text-xs text-emerald-600">Kâr: {formatPrice(profit)}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Aksiyon butonları */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDetail(service)}>
                    Detay
                  </Button>
                  {service.status === 'RECEIVED' && (
                    <Button variant="outline" size="sm" onClick={() => openQuote(service)}>
                      <Tag className="h-3.5 w-3.5" /> Teklif Ver
                    </Button>
                  )}
                  {service.status === 'QUOTED' && (
                    <>
                      <Button size="sm" onClick={() => handleStatusChange(service, 'APPROVED')}>
                        <CheckCircle className="h-3.5 w-3.5" /> Onayla
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleStatusChange(service, 'REJECTED')}>
                        <X className="h-3.5 w-3.5" /> Reddet
                      </Button>
                    </>
                  )}
                  {service.status === 'APPROVED' && (
                    <Button size="sm" onClick={() => handleStatusChange(service, 'IN_PROGRESS')}>
                      İşleme Başla
                    </Button>
                  )}
                  {service.status === 'IN_PROGRESS' && (
                    <Button size="sm" onClick={() => handleStatusChange(service, 'COMPLETED')}>
                      <CheckCircle className="h-3.5 w-3.5" /> Tamamlandı
                    </Button>
                  )}
                  {service.status === 'COMPLETED' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange(service, 'DELIVERED')}>
                        Teslim Et
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setShowDetail(service); setShowPaymentModal(true); }}>
                        <Banknote className="h-3.5 w-3.5" /> Tahsil Et
                      </Button>
                    </>
                  )}
                  {service.status === 'DELIVERED' && (
                    <Button variant="secondary" size="sm" onClick={() => { setShowDetail(service); setShowPaymentModal(true); }}>
                      <Banknote className="h-3.5 w-3.5" /> Tahsil Et
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detay Modal */}
      {showDetail && !showQuoteModal && !showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDetail(null)} />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{showDetail.service_number}</h2>
              <button onClick={() => setShowDetail(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Müşteri</p>
                  <p className="font-medium text-slate-900">{showDetail.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Telefon</p>
                  <p className="font-medium text-slate-900">{showDetail.customer_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Cihaz</p>
                  <p className="font-medium text-slate-900">{showDetail.device_brand} {showDetail.device_model}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">IMEI</p>
                  <p className="font-medium text-slate-900">{showDetail.imei || '-'}</p>
                </div>
              </div>
              {showDetail.issue_description && (
                <div>
                  <p className="text-xs text-slate-400">Arıza Açıklaması</p>
                  <p className="text-slate-700">{showDetail.issue_description}</p>
                </div>
              )}
              {showDetail.work_to_be_done && (
                <div>
                  <p className="text-xs text-slate-400">Yapılacak İşlem</p>
                  <p className="text-slate-700">{showDetail.work_to_be_done}</p>
                </div>
              )}
              {showDetail.notes && (
                <div>
                  <p className="text-xs text-slate-400">Notlar</p>
                  <p className="text-slate-700">{showDetail.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="text-xs text-slate-400">Parça Maliyeti</p>
                  <p className="font-bold text-red-600">{formatPrice(showDetail.parts_cost)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">İşçilik</p>
                  <p className="font-bold text-red-600">{formatPrice(showDetail.labor_cost)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Servis Fiyatı</p>
                  <p className="font-bold text-slate-900">{formatPrice(showDetail.service_price)}</p>
                </div>
              </div>
              {showDetail.pickup_requested && (
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-700">Adresten Alınacak</p>
                  <p className="text-sm text-amber-600">{showDetail.pickup_address}</p>
                  <p className="text-sm text-amber-600">{showDetail.pickup_phone}</p>
                  {showDetail.pickup_date && <p className="text-sm text-amber-600">Tarih: {showDetail.pickup_date}</p>}
                </div>
              )}
              <div className="flex justify-between">
                <p className="text-xs text-slate-400">Durum</p>
                <Badge variant={statusVariant(showDetail.status)}>{SERVICE_STATUS_LABELS[showDetail.status]}</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fiyat Teklifi Modal - Multi-option */}
      {showQuoteModal && showDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setShowQuoteModal(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Fiyat Teklifi</h2>
              <button onClick={() => !saving && setShowQuoteModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" disabled={saving}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">Müşteriye birden fazla seçenek sunabilirsiniz. Örn: TFT Ekran, OLED Ekran, Orjinal Ekran.</p>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              {quoteOptions.map((opt, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Seçenek {i + 1}</span>
                    {quoteOptions.length > 1 && (
                      <button onClick={() => removeOption(i)} className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600" disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Input
                    label="Seçenek Adı *"
                    value={opt.option_name}
                    onChange={(e) => updateOption(i, 'option_name', e.target.value)}
                    placeholder="Örn: TFT Ekran"
                    disabled={saving}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Parça (₺)" type="number" min={0} value={opt.parts_cost} onChange={(e) => updateOption(i, 'parts_cost', Number(e.target.value))} disabled={saving} />
                    <Input label="İşçilik (₺)" type="number" min={0} value={opt.labor_cost} onChange={(e) => updateOption(i, 'labor_cost', Number(e.target.value))} disabled={saving} />
                    <Input label="Fiyat (₺)" type="number" min={0} value={opt.service_price} onChange={(e) => updateOption(i, 'service_price', Number(e.target.value))} disabled={saving} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Tahmini Kâr:</span>
                    <span className="font-bold text-emerald-600">{formatPrice(opt.service_price - opt.parts_cost - opt.labor_cost)}</span>
                  </div>
                </div>
              ))}

              <button
                onClick={addOption}
                disabled={saving}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-electric-300 hover:text-electric-600"
              >
                <Plus className="h-4 w-4" /> Seçenek Ekle
              </button>

              <Textarea label="Notlar" value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} rows={2} disabled={saving} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowQuoteModal(false)} disabled={saving}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleSaveQuote} disabled={saving}>Teklif Gönder</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tahsilat Modal */}
      {showPaymentModal && showDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setShowPaymentModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Servis Tahsilatı</h2>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="mb-4 rounded-xl bg-slate-50 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Servis Fiyatı:</span>
                <span className="font-bold text-slate-900">{formatPrice(showDetail.service_price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Parça + İşçilik:</span>
                <span className="text-red-600">{formatPrice(showDetail.parts_cost + showDetail.labor_cost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Kâr:</span>
                <span className="font-bold text-emerald-600">{formatPrice(showDetail.service_price - showDetail.parts_cost - showDetail.labor_cost)}</span>
              </div>
            </div>
            <Select label="Ödeme Yöntemi" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Nakit</option>
              <option value="card">Kart</option>
              <option value="bank_transfer">Havale/EFT</option>
            </Select>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)} disabled={saving}>İptal</Button>
              <Button variant="secondary" className="flex-1" loading={saving} onClick={handlePayment} disabled={saving}>
                <Banknote className="h-4 w-4" />
                Tahsil Et ve Satış Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
