import { useState, useEffect, useRef } from 'react';
import { TrendingUp, CheckCircle, ArrowRight, Camera, X, ImagePlus, MapPin, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { KvkkLink } from '@/components/KvkkLink';
import { trError } from '@/lib/errors';
import { navigate } from '@/lib/router';
import { uploadDevicePhotos, removeDevicePhoto } from '@/lib/photo-upload';

const MAX_PHOTOS = 6;

export function SellPhonePage() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [requestNumber, setRequestNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [kvkkAlreadyAccepted, setKvkkAlreadyAccepted] = useState(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const [pickupRequested, setPickupRequested] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupSlotId, setPickupSlotId] = useState('');
  const [deliverySlots, setDeliverySlots] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_legal_acknowledgements')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      setKvkkAlreadyAccepted((data?.length ?? 0) > 0);
      const { data: slots } = await supabase.from('delivery_slots').select('id, label').eq('is_active', true).order('sort_order');
      setDeliverySlots((slots as { id: string; label: string }[]) || []);
    })();
  }, [user]);

  const [form, setForm] = useState({
    brand: '', model: '', storage: '', color: '', battery_health: '',
    cosmetic_condition: '', screen_condition: '', changed_parts: '', imei: '',
  });

  const update = (key: string, value: string) => setForm({ ...form, [key]: value });

  const steps = ['Marka & Model', 'Detaylar', 'Durum', 'Fotoğraflar', 'IMEI', 'Tamamla'];

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

  const handleSubmit = async () => {
    setError('');
    if (!form.brand.trim() || !form.model.trim()) { setError('Marka ve model zorunludur'); return; }
    if (pickupRequested && (!pickupAddress.trim() || !pickupPhone.trim() || !pickupDate)) { setError('Evden teslim için adres, telefon ve tarih zorunludur'); return; }
    if (!kvkkAlreadyAccepted && !kvkkConsent) { setError('KVKK aydınlatma metnini okuyup onaylamanız zorunludur'); return; }
    if (!user) { navigate('/login'); return; }

    setSaving(true);
    const { data, error: err } = await supabase.from('sell_phone_requests').insert({
      user_id: user.id,
      brand: form.brand,
      model: form.model,
      storage: form.storage || null,
      color: form.color || null,
      battery_health: form.battery_health || null,
      cosmetic_condition: form.cosmetic_condition || null,
      screen_condition: form.screen_condition || null,
      changed_parts: form.changed_parts || null,
      imei: form.imei || null,
      photos: photos.length > 0 ? photos : null,
      customer_name: (profile?.first_name || '') + ' ' + (profile?.last_name || ''),
      customer_phone: profile?.phone || null,
      customer_email: profile?.email || user.email,
      pickup_preference: pickupRequested ? 'EVDEN_ALIM' : null,
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
    setRequestNumber((data as { request_number: string }).request_number);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="premium-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Talebiniz Alındı!</h1>
          <p className="mt-2 text-sm text-slate-500">
            Telefonunuz için en kısa sürede teklif sunacağız. Talep numaranız:
          </p>
          <p className="mt-3 rounded-xl bg-slate-50 px-4 py-2 font-mono text-lg font-bold text-electric-600">
            {requestNumber}
          </p>
          <p className="mt-4 text-sm text-slate-400">Teklif hazır olduğunda size bildirim göndereceğiz.</p>
          <Button className="mt-6" onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <TrendingUp className="h-6 w-6 text-purple-500" />
            Telefonunu Sat
          </h1>
          <button onClick={() => navigate('/sell-phone-requests')} className="text-sm font-medium text-electric-600 hover:text-electric-700">
            Taleplerim
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Eski telefonunuzu değerlendirin, teklif alın</p>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-electric-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
              {step > i + 1 ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded ${step > i + 1 ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>}

      <div className="premium-card p-5">
        {step === 1 && (
          <div className="space-y-3">
            <Input label="Marka *" value={form.brand} onChange={(e) => update('brand', e.target.value)} placeholder="Apple" />
            <Input label="Model *" value={form.model} onChange={(e) => update('model', e.target.value)} placeholder="iPhone 13" />
            <Button className="w-full" onClick={() => setStep(2)} disabled={!form.brand || !form.model}>
              Devam <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Input label="Hafıza" value={form.storage} onChange={(e) => update('storage', e.target.value)} placeholder="128 GB" />
            <Input label="Renk" value={form.color} onChange={(e) => update('color', e.target.value)} placeholder="Siyah" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Geri</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Devam <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Select label="Pil Sağlığı" value={form.battery_health} onChange={(e) => update('battery_health', e.target.value)}>
              <option value="">Seçin</option>
              <option value="100">100% (Yeni)</option>
              <option value="95">95%+</option>
              <option value="90">90-95%</option>
              <option value="85">85-90%</option>
              <option value="80">80-85%</option>
              <option value="below80">80% Altı</option>
            </Select>
            <Select label="Kozmetik Durum" value={form.cosmetic_condition} onChange={(e) => update('cosmetic_condition', e.target.value)}>
              <option value="">Seçin</option>
              <option value="Sıfır Ayarında">Sıfır Ayarında</option>
              <option value="Çok Temiz">Çok Temiz</option>
              <option value="Temiz">Temiz</option>
              <option value="Orta">Orta</option>
              <option value="Kullanılmış">Kullanılmış</option>
            </Select>
            <Select label="Ekran Durumu" value={form.screen_condition} onChange={(e) => update('screen_condition', e.target.value)}>
              <option value="">Seçin</option>
              <option value="Orijinal - Temiz">Orijinal - Temiz</option>
              <option value="Orijinal - Çizik">Orijinal - Çizik</option>
              <option value="Orijinal - Kırık">Orijinal - Kırık</option>
              <option value="Değişmiş">Değişmiş</option>
            </Select>
            <Textarea label="Değişen Parçalar" value={form.changed_parts} onChange={(e) => update('changed_parts', e.target.value)} rows={2} placeholder="Örn: Batarya değişti, ekran orijinal" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Geri</Button>
              <Button className="flex-1" onClick={() => setStep(4)}>Devam <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Cihaz Fotoğrafları</h3>
              <p className="mt-1 text-sm text-slate-500">
                Telefonunuzun durumunu gösteren fotoğraflar ekleyin. Net ve aydınlık ortamda çekim yapın. En fazla {MAX_PHOTOS} fotoğraf yükleyebilirsiniz.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {photos.map((url, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img src={url} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removePhoto(url, i)}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-electric-400 hover:text-electric-500 disabled:opacity-50"
                  type="button"
                >
                  {uploading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
                  ) : (
                    <>
                      <ImagePlus className="h-7 w-7" />
                      <span className="text-xs font-medium">Fotoğraf Ekle</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            {photoError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{photoError}</p>}

            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Camera className="h-4 w-4 shrink-0" />
              <span>Ön yüz, arka yüz, ekran ve varsa hasarlı bölümlerin fotoğraflarını ekleyin. Bu, daha hızlı ve doğru teklif almanızı sağlar.</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)} disabled={uploading}>Geri</Button>
              <Button className="flex-1" onClick={() => setStep(5)} disabled={uploading}>
                {photos.length > 0 ? 'Devam' : 'Atla'} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <Input label="IMEI" value={form.imei} onChange={(e) => update('imei', e.target.value)} placeholder="15 haneli IMEI numarası" maxLength={15} />
            <p className="text-xs text-slate-400">IMEI numarasını *#06# tuşlayarak öğrenebilirsiniz.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>Geri</Button>
              <Button className="flex-1" onClick={() => setStep(6)}>Devam <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800">Bilgileri Kontrol Edin</h3>
            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Marka:</span><span className="text-slate-800">{form.brand}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Model:</span><span className="text-slate-800">{form.model}</span></div>
              {form.storage && <div className="flex justify-between"><span className="text-slate-400">Hafıza:</span><span className="text-slate-800">{form.storage}</span></div>}
              {form.color && <div className="flex justify-between"><span className="text-slate-400">Renk:</span><span className="text-slate-800">{form.color}</span></div>}
              {form.battery_health && <div className="flex justify-between"><span className="text-slate-400">Pil:</span><span className="text-slate-800">{form.battery_health}%</span></div>}
              {form.cosmetic_condition && <div className="flex justify-between"><span className="text-slate-400">Kozmetik:</span><span className="text-slate-800">{form.cosmetic_condition}</span></div>}
              {form.imei && <div className="flex justify-between"><span className="text-slate-400">IMEI:</span><span className="text-slate-800">{form.imei}</span></div>}
              <div className="flex justify-between"><span className="text-slate-400">Fotoğraflar:</span><span className="text-slate-800">{photos.length} adet</span></div>
            </div>

            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                    <img src={url} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Evden teslim secenegi */}
            <div className="rounded-xl border border-slate-200 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pickupRequested} onChange={(e) => setPickupRequested(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Truck className="h-4 w-4 text-electric-500" /> Cihazımı evden alsınlar</span>
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
                  <p className="flex items-start gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /> Cihazınızı belirttiğiniz adresten alıp ödemenizi aynı adreste yapacağız.</p>
                </div>
              )}
            </div>

            {!kvkkAlreadyAccepted ? (
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={kvkkConsent} onChange={(e) => setKvkkConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" />
                <span className="min-w-0 text-xs leading-5 text-slate-500 break-words"><KvkkLink /> kapsamında kişisel verilerimin işlenmesini kabul ediyorum.</span>
              </label>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" /> KVKK aydınlatma metnini daha önce kabul ettiniz.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(5)} disabled={saving}>Geri</Button>
              <Button className="flex-1" loading={saving} onClick={handleSubmit} disabled={saving}>Talebi Gönder</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
