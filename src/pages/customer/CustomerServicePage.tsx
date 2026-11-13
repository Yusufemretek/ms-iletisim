import { useEffect, useState } from 'react';
import { Wrench, Plus, Smartphone, MapPin, CheckCircle, X, Clock, Tag, FileText, ChevronRight, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { KvkkLink } from '@/components/KvkkLink';
import { formatPrice, formatDateTime, SERVICE_STATUS_LABELS, SERVICE_STATUS_FLOW } from '@/lib/format';
import type { ServiceRecord, ServiceStatus, DeliverySlot, Address } from '@/lib/types';

interface QuoteOption {
  id: string;
  option_name: string;
  service_price: number;
  parts_cost: number;
  labor_cost: number;
  sort_order: number;
}

export function CustomerServicePage() {
  const { user, profile } = useAuth();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Detail modal
  const [detailService, setDetailService] = useState<ServiceRecord | null>(null);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [quoteResponding, setQuoteResponding] = useState(false);

  // KVKK consent state
  const [kvkkAlreadyAccepted, setKvkkAlreadyAccepted] = useState(false);
  const [kvkkConsent, setKvkkConsent] = useState(false);

  // Form
  const [deviceBrand, setDeviceBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [imei, setImei] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [pickupRequested, setPickupRequested] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupSlotId, setPickupSlotId] = useState('');

  const loadAll = async () => {
    setLoading(true);
    const [{ data: svcData }, { data: slotData }, { data: addrData }, { data: ackData }] = await Promise.all([
      supabase.from('service_records').select('*').eq('user_id', user?.id || '').order('created_at', { ascending: false }),
      supabase.from('delivery_slots').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('addresses').select('*').eq('user_id', user?.id || '').order('created_at', { ascending: false }),
      supabase.from('user_legal_acknowledgements').select('id').eq('user_id', user?.id || '').limit(1),
    ]);
    setServices((svcData as ServiceRecord[]) || []);
    setSlots((slotData as DeliverySlot[]) || []);
    setAddresses((addrData as Address[]) || []);
    setKvkkAlreadyAccepted((ackData?.length ?? 0) > 0);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadQuoteOptions = async (serviceId: string) => {
    const { data } = await supabase
      .from('service_quote_options')
      .select('*')
      .eq('service_id', serviceId)
      .order('sort_order', { ascending: true });
    setQuoteOptions((data as QuoteOption[]) || []);
    setSelectedOptionId(null);
  };

  const SERVICE_HISTORY_STATUSES: ServiceStatus[] = ['COMPLETED', 'DELIVERED', 'PAID', 'REJECTED', 'CANCELLED'];
  const activeServices = services.filter(s => !SERVICE_HISTORY_STATUSES.includes(s.status));
  const historyServices = services.filter(s => SERVICE_HISTORY_STATUSES.includes(s.status));

  const handleSubmit = async () => {
    setError('');
    if (!deviceBrand.trim() || !deviceModel.trim()) { setError('Cihaz marka ve model zorunludur'); return; }
    if (!issueDescription.trim()) { setError('Arıza açıklaması zorunludur'); return; }
    if (!kvkkAlreadyAccepted && !kvkkConsent) { setError('KVKK aydınlatma metnini okuyup onaylamanız zorunludur'); return; }
    if (pickupRequested) {
      if (!pickupAddress.trim()) { setError('Alım adresi zorunludur'); return; }
      if (!pickupPhone.trim()) { setError('Telefon zorunludur'); return; }
      if (!pickupDate) { setError('Tarih seçiniz'); return; }
      if (!pickupSlotId) { setError('Saat aralığı seçiniz'); return; }
    }

    setSaving(true);
    const { error: err } = await supabase.from('service_records').insert({
      user_id: user?.id,
      customer_name: (profile?.first_name || '') + ' ' + (profile?.last_name || ''),
      customer_phone: profile?.phone || pickupPhone,
      customer_email: profile?.email || user?.email,
      device_brand: deviceBrand,
      device_model: deviceModel,
      imei: imei || null,
      issue_description: issueDescription,
      pickup_requested: pickupRequested,
      pickup_address: pickupRequested ? pickupAddress : null,
      pickup_phone: pickupRequested ? pickupPhone : null,
      pickup_date: pickupRequested ? pickupDate : null,
      pickup_slot_id: pickupRequested ? pickupSlotId : null,
      status: 'RECEIVED',
    });

    // Record KVKK consent if first time
    if (!err && !kvkkAlreadyAccepted) {
      const { data: legalDoc } = await supabase
        .from('legal_documents')
        .select('id, version')
        .eq('document_type', 'kvkk_notice')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (legalDoc) {
        await supabase.from('user_legal_acknowledgements').insert({
          user_id: user?.id,
          document_id: legalDoc.id,
          document_version: legalDoc.version,
          source: 'service',
        });
        await supabase.from('consent_logs').insert({
          user_id: user?.id,
          consent_type: 'kvkk_notice',
          status: 'granted',
          document_version: legalDoc.version,
          source: 'service',
        });
        setKvkkAlreadyAccepted(true);
      }
    }

    setSaving(false);
    if (err) { setError('İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.'); return; }
    setSuccess('Teklif talebiniz oluşturuldu! En kısa sürede size fiyat teklifi göndereceğiz.');
    setShowForm(false);
    setDeviceBrand(''); setDeviceModel(''); setImei(''); setIssueDescription('');
    setPickupRequested(false); setPickupAddress(''); setPickupPhone(''); setPickupDate(''); setPickupSlotId('');
    setKvkkConsent(false);
    loadAll();
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleQuoteResponse = async (response: 'accept' | 'reject') => {
    if (!detailService) return;
    if (response === 'accept' && !selectedOptionId) {
      setError('Lütfen bir teklif seçeneği seçin.');
      return;
    }
    setQuoteResponding(true);
    const { error: err } = await supabase.rpc('respond_to_service_quote', {
      p_service_id: detailService.id,
      p_response: response,
      p_selected_option_id: response === 'accept' ? selectedOptionId : null,
    });
    setQuoteResponding(false);
    if (err) { setError('İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.'); return; }
    setDetailService(null);
    setQuoteOptions([]);
    setSelectedOptionId(null);
    loadAll();
    setSuccess(response === 'accept' ? 'Teklifi onayladınız.' : 'Teklifi reddettiniz.');
    setTimeout(() => setSuccess(''), 5000);
  };

  const statusVariant = (status: ServiceStatus): 'default' | 'info' | 'success' | 'amber' | 'error' => {
    switch (status) {
      case 'RECEIVED': return 'default';
      case 'QUOTED': return 'info';
      case 'APPROVED': return 'amber';
      case 'IN_PROGRESS': return 'info';
      case 'COMPLETED':
      case 'DELIVERED':
      case 'PAID': return 'success';
      case 'REJECTED':
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  // Service timeline
  const buildTimeline = (svc: ServiceRecord) => {
    const steps: { label: string; date: string | null; done: boolean }[] = [];
    const flowMap: Record<string, string | null> = {
      'Kayıt Alındı': svc.created_at,
      'Fiyat Teklifi Gönderildi': svc.quoted_at,
      'Onaylandı': svc.approved_at,
      'İşlem Devam Ediyor': svc.status === 'IN_PROGRESS' || svc.status === 'COMPLETED' || svc.status === 'DELIVERED' || svc.status === 'PAID' ? svc.updated_at : null,
      'Tamamlandı': svc.completed_at,
      'Teslim Edildi': svc.delivered_at,
    };
    const flowOrder = ['Kayıt Alındı', 'Fiyat Teklifi Gönderildi', 'Onaylandı', 'İşlem Devam Ediyor', 'Tamamlandı', 'Teslim Edildi'];
    const currentLabel = SERVICE_STATUS_LABELS[svc.status] || '';
    const currentIndex = flowOrder.indexOf(currentLabel);
    for (const label of flowOrder) {
      const date = flowMap[label];
      const idx = flowOrder.indexOf(label);
      steps.push({ label, date, done: date !== null || (currentIndex >= 0 && idx <= currentIndex) });
    }
    return steps;
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teknik Servis</h1>
          <p className="mt-1 text-sm text-slate-500">Cihazınız için teklif alın ve durumunu takip edin</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(''); }}>
          <Plus className="h-4 w-4" /> Teklif Al
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}

      {/* Tab switcher */}
      {!loading && services.length > 0 && (
        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Aktif İşlemler
            {activeServices.length > 0 && <span className="rounded-full bg-electric-100 px-1.5 py-0.5 text-[10px] font-bold text-electric-600">{activeServices.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            İşlem Geçmişi
            {historyServices.length > 0 && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{historyServices.length}</span>}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Wrench className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz servis talebiniz yok.</p>
          <Button className="mt-4" onClick={() => { setShowForm(true); setError(''); }}>
            <Plus className="h-4 w-4" /> İlk Teklif Talebini Oluştur
          </Button>
        </div>
      ) : activeTab === 'active' && activeServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Aktif servis talebiniz yok.</p>
          <Button className="mt-4" onClick={() => { setShowForm(true); setError(''); }}>
            <Plus className="h-4 w-4" /> Yeni Talep Oluştur
          </Button>
        </div>
      ) : activeTab === 'history' && historyServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz tamamlanan servis talebiniz yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(activeTab === 'active' ? activeServices : historyServices).map(svc => (
            <div key={svc.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-500 text-white">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{svc.service_number}</p>
                      <Badge variant={statusVariant(svc.status)}>{SERVICE_STATUS_LABELS[svc.status as ServiceStatus] || svc.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{svc.device_brand} {svc.device_model}</p>
                    {svc.imei && <p className="text-xs text-slate-400">IMEI: {svc.imei.slice(0,4)}•••••••{svc.imei.slice(-2)}</p>}
                    {svc.issue_description && <p className="mt-1 text-xs text-slate-500 line-clamp-2 break-words">Arıza: {svc.issue_description}</p>}
                    {svc.pickup_requested && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-amber-600 break-words">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" /> Adresten Alınacak: {svc.pickup_address}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">{formatDateTime(svc.created_at)}</p>
                  {svc.service_price > 0 && <p className="text-sm font-bold text-slate-900">{formatPrice(svc.service_price)}</p>}
                </div>
              </div>

              {/* Teklif butonu */}
              {svc.status === 'QUOTED' && (
                <div className="mt-3">
                  <Button size="sm" className="w-full" onClick={() => { setDetailService(svc); loadQuoteOptions(svc.id); }}>
                    <Tag className="h-4 w-4" /> Teklifi Gör
                  </Button>
                </div>
              )}

              {/* Detay butonu */}
              {svc.status !== 'QUOTED' && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => setDetailService(svc)}>
                    Detay <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setShowForm(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Teklif Talebi</h2>
              <button onClick={() => !saving && setShowForm(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" disabled={saving}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Marka *" value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)} placeholder="Apple" disabled={saving} />
                <Input label="Model *" value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} placeholder="iPhone 13" disabled={saving} />
              </div>
              <Input label="IMEI" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Opsiyonel" disabled={saving} />
              <Textarea label="Arıza Açıklaması *" value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} rows={3} placeholder="Cihazdaki arızayı detaylı açıklayın" disabled={saving} />

              {/* Adresten Al */}
              <div className="rounded-xl border border-slate-200 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickupRequested}
                    onChange={(e) => setPickupRequested(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                    disabled={saving}
                  />
                  <span className="text-sm font-medium text-slate-700">Adresimden Alınsın (Kurye)</span>
                </label>
                {pickupRequested && (
                  <div className="mt-3 space-y-3">
                    {addresses.length > 0 && (
                      <Select label="Kayıtlı Adres" value={selectedAddressId} onChange={(e) => {
                        setSelectedAddressId(e.target.value);
                        const a = addresses.find(x => x.id === e.target.value);
                        if (a) setPickupAddress(`${a.title}: ${a.city} ${a.district} ${a.neighborhood} ${a.street}`);
                      }}>
                        <option value="">Adres Seçin</option>
                        {addresses.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.title}: {a.city} {a.district}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Textarea label="Alım Adresi *" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} rows={2} placeholder="Tam adres" disabled={saving} />
                    <Input label="Telefon *" value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} placeholder="05XX XXX XX XX" disabled={saving} />
                    <Input label="Uygun Tarih *" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} disabled={saving} />
                    <Select label="Saat Aralığı *" value={pickupSlotId} onChange={(e) => setPickupSlotId(e.target.value)}>
                      <option value="">Saat Aralığı Seçin</option>
                      {slots.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* KVKK - only show if not already accepted */}
            {!kvkkAlreadyAccepted && (
              <label className="mt-4 flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={kvkkConsent} onChange={(e) => setKvkkConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" />
                <span className="min-w-0 text-xs leading-5 text-slate-500 break-words"><KvkkLink /> kapsamında kişisel verilerimin işlenmesini kabul ediyorum.</span>
              </label>
            )}
            {kvkkAlreadyAccepted && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" /> KVKK aydınlatma metnini daha önce kabul ettiniz.
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={saving}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleSubmit} disabled={saving}>Talebi Oluştur</Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Quote Modal */}
      {detailService && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !quoteResponding && setDetailService(null)} />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{detailService.service_number}</h2>
                <Badge variant={statusVariant(detailService.status)}>{SERVICE_STATUS_LABELS[detailService.status]}</Badge>
              </div>
              <button onClick={() => !quoteResponding && setDetailService(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" disabled={quoteResponding}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Servis bilgileri */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Cihaz</p>
                  <p className="font-medium text-slate-900">{detailService.device_brand} {detailService.device_model}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">IMEI</p>
                  <p className="font-medium text-slate-900">{detailService.imei || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Kayıt Tarihi</p>
                  <p className="font-medium text-slate-900">{formatDateTime(detailService.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Telefon</p>
                  <p className="font-medium text-slate-900">{detailService.customer_phone || '-'}</p>
                </div>
              </div>

              {detailService.issue_description && (
                <div>
                  <p className="text-xs text-slate-400">Arıza Açıklaması</p>
                  <p className="text-slate-700 break-words">{detailService.issue_description}</p>
                </div>
              )}

              {detailService.work_to_be_done && (
                <div>
                  <p className="text-xs text-slate-400">Yapılacak İşlem</p>
                  <p className="text-slate-700 break-words">{detailService.work_to_be_done}</p>
                </div>
              )}

              {/* Teklif seçenekleri */}
              {detailService.status === 'QUOTED' && quoteOptions.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Tag className="h-4 w-4 text-electric-500" /> Teklif Seçenekleri
                  </div>
                  <p className="text-xs text-slate-500">Onaylamak istediğiniz seçeneği işaretleyin.</p>
                  {quoteOptions.map((opt, i) => (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${selectedOptionId === opt.id ? 'border-electric-500 bg-electric-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <input
                        type="radio"
                        name="quote-option"
                        checked={selectedOptionId === opt.id}
                        onChange={() => setSelectedOptionId(opt.id)}
                        className="mt-1 h-4 w-4 accent-electric-500"
                        disabled={quoteResponding}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900">{opt.option_name}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-lg font-bold text-electric-600">{formatPrice(opt.service_price)}</span>
                          <span className="text-xs text-slate-400">Parça: {formatPrice(opt.parts_cost)} • İşçilik: {formatPrice(opt.labor_cost)}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Tek tekli eski format (fallback) */}
              {detailService.status === 'QUOTED' && quoteOptions.length === 0 && detailService.service_price > 0 && (
                <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Tag className="h-4 w-4 text-electric-500" /> Teklif Detayı
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">Parça Maliyeti:</span><span className="text-red-600">{formatPrice(detailService.parts_cost)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">İşçilik:</span><span className="text-red-600">{formatPrice(detailService.labor_cost)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span className="text-slate-800">Servis Fiyatı:</span><span className="text-electric-600">{formatPrice(detailService.service_price)}</span></div>
                </div>
              )}

              {detailService.notes && (
                <div>
                  <p className="text-xs text-slate-400">Açıklama</p>
                  <p className="text-slate-700 break-words">{detailService.notes}</p>
                </div>
              )}

              {detailService.quoted_at && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> Teklif Tarihi: {formatDateTime(detailService.quoted_at)}
                </div>
              )}

              {/* Kurye/adres bilgisi */}
              {detailService.pickup_requested && (
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-700">Adresten Alınacak</p>
                  <p className="text-sm text-amber-600 break-words">{detailService.pickup_address}</p>
                  <p className="text-sm text-amber-600">{detailService.pickup_phone}</p>
                  {detailService.pickup_date && <p className="text-sm text-amber-600">Tarih: {detailService.pickup_date}</p>}
                </div>
              )}

              {/* Zaman çizelgesi */}
              <div>
                <p className="mb-2 text-xs font-bold text-slate-500">Servis Geçmişi</p>
                <div className="space-y-2">
                  {buildTimeline(detailService).map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        {step.done ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${step.done ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{step.label}</p>
                        {step.date && <p className="text-xs text-slate-400">{formatDateTime(step.date)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teklif yanıtı butonları */}
              {detailService.status === 'QUOTED' && (
                <div className="flex gap-2 border-t border-slate-100 pt-4">
                  <Button variant="danger" className="flex-1" loading={quoteResponding} onClick={() => handleQuoteResponse('reject')} disabled={quoteResponding}>
                    <X className="h-4 w-4" /> Reddet
                  </Button>
                  <Button className="flex-1" loading={quoteResponding} onClick={() => handleQuoteResponse('accept')} disabled={quoteResponding || !selectedOptionId}>
                    <CheckCircle className="h-4 w-4" /> Onayla
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
