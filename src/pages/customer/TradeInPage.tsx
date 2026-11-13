import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Search, CheckCircle, Camera, X, ImagePlus, Smartphone, MapPin, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { KvkkLink } from '@/components/KvkkLink';
import { formatPrice, TRADE_IN_STATUS_LABELS } from '@/lib/format';
import { trError } from '@/lib/errors';
import { navigate } from '@/lib/router';
import { uploadDevicePhotos, removeDevicePhoto } from '@/lib/photo-upload';
import type { ProductWithImages } from '@/lib/types';

export function TradeInPage() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tradeNumber, setTradeNumber] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<ProductWithImages | null>(null);
  const [oldBrand, setOldBrand] = useState('');
  const [oldModel, setOldModel] = useState('');
  const [oldImei, setOldImei] = useState('');
  const [oldCondition, setOldCondition] = useState('');
  const [estimatedOffer, setEstimatedOffer] = useState(0);
  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [kvkkAlreadyAccepted, setKvkkAlreadyAccepted] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pickupRequested, setPickupRequested] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupSlotId, setPickupSlotId] = useState('');
  const [deliverySlots, setDeliverySlots] = useState<{ id: string; label: string }[]>([]);

  const MAX_PHOTOS = 6;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;
    if (!user) { navigate('/login'); return; }
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) { setPhotoError(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz.`); return; }
    setUploading(true);
    setPhotoError('');
    try {
      const result = await uploadDevicePhotos(files.slice(0, remaining), user.id);
      setPhotos((prev) => [...prev, ...result.urls]);
      if (result.message) setPhotoError(result.message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (url: string, index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    await removeDevicePhoto(url);
  };

  useEffect(() => {
    loadProducts();
    checkKvkkConsent();
    loadSlots();
  }, [user]);

  const loadSlots = async () => {
    const { data } = await supabase.from('delivery_slots').select('id, label').eq('is_active', true).order('sort_order');
    setDeliverySlots((data as { id: string; label: string }[]) || []);
  };

  const checkKvkkConsent = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_legal_acknowledgements')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    setKvkkAlreadyAccepted((data?.length ?? 0) > 0);
  };

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*, product_images(*)').eq('is_active', true).in('type', ['new_phone', 'used_phone', 'tablet', 'smartwatch']).order('name');
    setProducts((data as ProductWithImages[]) || []);
    setLoading(false);
  };

  const filtered = products.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(search.toLowerCase())
  );

  const remaining = selectedProduct ? selectedProduct.sale_price - estimatedOffer : 0;

  const handleSubmit = async () => {
    if (saving) return;
    setError('');
    if (!selectedProduct) { setError('Lütfen yeni bir telefon seçin'); return; }
    if (!oldBrand.trim() || !oldModel.trim()) { setError('Eski cihaz marka ve model zorunludur'); return; }
    if (pickupRequested && (!pickupAddress.trim() || !pickupPhone.trim() || !pickupDate)) { setError('Evden teslim için adres, telefon ve tarih zorunludur'); return; }
    if (!kvkkAlreadyAccepted && !kvkkConsent) { setError('KVKK aydınlatma metnini okuyup onaylamanız zorunludur'); return; }
    if (!user) { navigate('/login'); return; }

    setSaving(true);
    const { data, error: err } = await supabase.from('trade_ins').insert({
      user_id: user.id,
      new_product_id: selectedProduct.id,
      new_product_name: selectedProduct.name,
      new_product_price: selectedProduct.sale_price,
      old_device_brand: oldBrand,
      old_device_model: oldModel,
      old_device_imei: oldImei || null,
      old_device_offer: estimatedOffer || 0,
      old_device_condition: oldCondition || null,
      photos: photos.length > 0 ? photos : null,
      remaining_amount: remaining,
      customer_name: (profile?.first_name || '') + ' ' + (profile?.last_name || ''),
      customer_phone: profile?.phone || null,
      pickup_requested: pickupRequested,
      pickup_address: pickupRequested ? pickupAddress : null,
      pickup_phone: pickupRequested ? pickupPhone : null,
      pickup_date: pickupRequested ? pickupDate : null,
      pickup_slot: pickupRequested && pickupSlotId ? pickupSlotId : null,
      status: 'PENDING',
    }).select().single();

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
          user_id: user.id,
          document_id: legalDoc.id,
          document_version: legalDoc.version,
          source: 'service',
        });
        await supabase.from('consent_logs').insert({
          user_id: user.id,
          consent_type: 'kvkk_notice',
          status: 'granted',
          document_version: legalDoc.version,
          source: 'service',
        });
        setKvkkAlreadyAccepted(true);
      }
    }

    setSaving(false);
    if (err) { console.error('Talep kaydedilemedi:', err); setError(trError(err, 'İşlem sırasında bir sorun oluştu. Lütfen tekrar deneyin.')); return; }
    setTradeNumber((data as { trade_number: string }).trade_number);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="premium-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Takas Talebiniz Alındı!</h1>
          <p className="mt-2 text-sm text-slate-500">Takas numaranız: <span className="font-mono font-bold text-electric-600">{tradeNumber}</span></p>
          <p className="mt-4 text-sm text-slate-400">Takasınız admin onayından sonra kesinleşecektir.</p>
          <Button className="mt-6" onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <RefreshCw className="h-6 w-6 text-cyan-500" />
            Telefon Takası
          </h1>
          <button onClick={() => navigate('/trade-in-requests')} className="text-sm font-medium text-electric-600 hover:text-electric-700">
            Taleplerim
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Eski telefonunuzu verin, yeni telefonuza indirim alın</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Yeni telefon seçimi */}
        <div className="premium-card p-5">
          <h2 className="mb-3 font-bold text-slate-800">1. Yeni Telefon Seçin</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Telefon ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark w-full py-2.5 pl-10 pr-3 text-sm"
            />
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-50" />)}</div>
            ) : filtered.map(p => {
              const img = p.product_images?.find((i) => i.is_primary) || p.product_images?.[0];
              return (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${selectedProduct?.id === p.id ? 'border-electric-500 bg-electric-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                  {img ? (
                    <img src={img.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Smartphone className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.brand} {p.model}</p>
                </div>
                <span className="text-sm font-bold text-electric-600">{formatPrice(p.sale_price)}</span>
              </button>
              );
            })}
          </div>
        </div>

        {/* Eski cihaz bilgileri */}
        <div className="premium-card p-5">
          <h2 className="mb-3 font-bold text-slate-800">2. Eski Cihazınız</h2>
          <div className="space-y-3">
            <Input label="Marka *" value={oldBrand} onChange={(e) => setOldBrand(e.target.value)} placeholder="Samsung" />
            <Input label="Model *" value={oldModel} onChange={(e) => setOldModel(e.target.value)} placeholder="Galaxy S21" />
            <Input label="IMEI" value={oldImei} onChange={(e) => setOldImei(e.target.value)} placeholder="Opsiyonel" maxLength={15} />
            <Select label="Durum" value={oldCondition} onChange={(e) => setOldCondition(e.target.value)}>
              <option value="">Seçin</option>
              <option value="Sıfır Ayarında">Sıfır Ayarında</option>
              <option value="Çok Temiz">Çok Temiz</option>
              <option value="Temiz">Temiz</option>
              <option value="Orta">Orta</option>
              <option value="Kullanılmış">Kullanılmış</option>
            </Select>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Cihaz Fotoğrafları</label>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img src={url} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removePhoto(url, i)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-electric-400 hover:text-electric-500 disabled:opacity-50"
                    type="button"
                  >
                    {uploading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
                    ) : (
                      <>
                        <ImagePlus className="h-6 w-6" />
                        <span className="text-[10px] font-medium">Fotoğraf Ekle</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
            {photoError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{photoError}</p>}
              <p className="mt-1 text-xs text-slate-400">En fazla {MAX_PHOTOS} fotoğraf. Net ve aydınlık ortamda çekin.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tahmini Takas Değeri (₺)</label>
              <input
                type="number"
                min={0}
                value={(estimatedOffer) || ''}
                onChange={(e) => setEstimatedOffer(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Bu tahmini bir değerdir. Kesin takas fiyatı mağaza tarafından belirlenir.</p>
            </div>
          </div>

          {selectedProduct && (
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Yeni Telefon:</span><span className="text-slate-800">{formatPrice(selectedProduct.sale_price)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Eski Cihaz Takas:</span><span className="text-emerald-600">-{formatPrice(estimatedOffer)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span className="text-slate-800">Kalan Tutar:</span><span className="text-electric-600">{formatPrice(remaining)}</span></div>
            </div>
          )}

          {/* Evden teslim secenegi */}
          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pickupRequested} onChange={(e) => setPickupRequested(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Truck className="h-4 w-4 text-electric-500" /> Eski cihazımı evden alsınlar</span>
            </label>
            {pickupRequested && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Adres *</label>
                  <textarea
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Mahalle, sokak, ilçe, il"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Telefon *</label>
                    <input type="tel" value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} placeholder="05xx xxx xx xx" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Tarih *</label>
                    <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
                  </div>
                </div>
                {deliverySlots.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Saat Aralığı</label>
                    <select value={pickupSlotId} onChange={(e) => setPickupSlotId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none">
                      <option value="">Seçin (opsiyonel)</option>
                      {deliverySlots.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                )}
                <p className="flex items-start gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /> Eski cihazınızı belirttiğiniz adresten alıp, yeni telefonunuzu aynı adrese teslim edeceğiz.</p>
              </div>
            )}
          </div>

          {!kvkkAlreadyAccepted ? (
            <label className="mt-4 flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={kvkkConsent} onChange={(e) => setKvkkConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" />
              <span className="min-w-0 text-xs leading-5 text-slate-500 break-words"><KvkkLink /> kapsamında kişisel verilerimin işlenmesini kabul ediyorum.</span>
            </label>
          ) : (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" /> KVKK aydınlatma metnini daha önce kabul ettiniz.
            </p>
          )}
          <Button className="mt-3 w-full" loading={saving} onClick={handleSubmit} disabled={!selectedProduct || saving}>
            Takas Talebi Oluştur
          </Button>
        </div>
      </div>
    </div>
  );
}
