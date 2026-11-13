import { useEffect, useState } from 'react';
import { MapPin, Plus, Check, Banknote, CreditCard, ArrowRight, Truck, Package, Clock, Landmark, Store, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatPrice, paymentMethodLabel, DELIVERY_TYPE_LABELS } from '@/lib/format';
import type { Address, PaymentMethod, DeliveryType, DeliverySlot, InstallmentSetting, CartItem } from '@/lib/types';
import { navigate } from '@/lib/router';
import { KvkkLink } from '@/components/KvkkLink';
import { trError } from '@/lib/errors';

export function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { user, profile } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('GEL_AL');
  const [deliverySlotId, setDeliverySlotId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [installments, setInstallments] = useState<InstallmentSetting[]>([]);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [minOrderAmount, setMinOrderAmount] = useState(0);

  const [newAddr, setNewAddr] = useState({
    title: '', city: 'Niğde', district: '', neighborhood: '', street: '',
    building_no: '', apartment_no: '', directions: '', phone: '',
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const firstProductId = items.length > 0 ? items[0].product_id : null;
    const [{ data: addrData }, { data: slotData }, { data: instData }, { data: settingsData }] = await Promise.all([
      supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('delivery_slots').select('*').eq('is_active', true).order('sort_order'),
      supabase.rpc('get_installment_options', { p_product_id: firstProductId }),
      supabase.from('store_settings').select('min_order_amount').maybeSingle(),
    ]);
    const addrList = (addrData as Address[]) || [];
    setAddresses(addrList);
    setSlots((slotData as DeliverySlot[]) || []);
    setInstallments((instData as InstallmentSetting[]) || []);
    setMinOrderAmount((settingsData as { min_order_amount: number } | null)?.min_order_amount ?? 0);
    const defaultAddr = addrList.find(a => a.is_default) || addrList[0];
    if (defaultAddr) setSelectedAddress(defaultAddr.id);
    setLoading(false);
  };

  if (!user) return null;

  if (items.length === 0 && !loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">Sepetiniz Boş</h1>
        <Button className="mt-4" onClick={() => navigate('/urunler')}>Ürünleri İncele</Button>
      </div>
    );
  }

  const handleAddAddress = async () => {
    if (!newAddr.title || !newAddr.district || !newAddr.neighborhood || !newAddr.street) {
      setError('Lütfen zorunlu alanları doldurun.'); return;
    }
    const { data, error: insertError } = await supabase.from('addresses').insert({ ...newAddr, city: 'Niğde', user_id: user.id }).select().single();
    if (insertError) { setError(trError(insertError)); return; }
    setAddresses([...addresses, data as Address]);
    setSelectedAddress((data as Address).id);
    setNewAddr({ title: '', city: 'Niğde', district: '', neighborhood: '', street: '', building_no: '', apartment_no: '', directions: '', phone: '' });
    setShowAddressModal(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError('');
    const hasPickupOnly = items.some(i => (i as CartItem & { pickup_only?: boolean }).pickup_only);
    if (hasPickupOnly && deliveryType === 'KURYE') { setError('Sepetinizde sadece dükkandan alınabilen ürünler var. Lütfen "Dükkandan Al" seçeneğini seçin.'); return; }
    if (deliveryType === 'KURYE' && minOrderAmount > 0 && total < minOrderAmount) { setError(`Kurye teslimatı için minimum sepet tutarı ${formatPrice(minOrderAmount)}'dir. Sepetiniz ${formatPrice(total)}.`); return; }
    if (deliveryType === 'KURYE' && !selectedAddress) { setError('Kurye teslimatı için adres seçiniz.'); return; }
    if (deliveryType === 'KURYE' && !deliverySlotId) { setError('Saat aralığı seçiniz.'); return; }
    if (items.length === 0) { setError('Sepetiniz boş.'); return; }

    if (profile?.is_banned) {
      setError('Hesabınız yasaklanmıştır. Sipariş veremezsiniz. Lütfen bizimle iletişime geçin.');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    const itemsJson = items.map(i => ({
      product_id: i.product_id,
      variant_id: i.variant_id || null,
      variant_storage: i.variant_storage || null,
      unit_price: i.unit_price,
      quantity: i.quantity,
    }));
    const paymentsJson = [{ payment_method: paymentMethod, amount: total }];

    const { data, error: rpcError } = await supabase.rpc('create_sale', {
      p_sales_channel: 'ONLINE',
      p_customer_name: (profile?.first_name || '') + ' ' + (profile?.last_name || ''),
      p_customer_phone: profile?.phone || null,
      p_customer_email: user.email || '',
      p_user_id: user.id,
      p_items: itemsJson,
      p_payments: paymentsJson,
      p_delivery_type: deliveryType,
      p_delivery_slot_id: deliverySlotId || null,
      p_address_id: deliveryType === 'KURYE' ? selectedAddress : null,
      p_note: note || null,
      p_discount: 0,
      p_installment_count: paymentMethod === 'card_on_delivery' ? installmentCount : 1,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('Yetersiz stok')) {
        setError('Bazı ürünlerin stoku yetersiz. Lütfen sepetinizi kontrol edin.');
      } else if (msg.includes('Pasif urun')) {
        setError('Bazı ürünler artık satışta değil. Lütfen sepetinizi kontrol edin.');
      } else if (msg.includes('IMEI')) {
        setError('Bu cihaz zaten satılmış. Lütfen başka bir ürün seçin.');
      } else {
        setError('Sipariş oluşturulamadı. Lütfen tekrar deneyin.');
      }
      setSubmitting(false);
      return;
    }

    clearCart();
    navigate(`/order/${data}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Sipariş Tamamla</h1>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Teslimat yöntemi */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Teslimat yalnızca <strong>Niğde</strong> il sınırları içindir. Mağazadan teslim al veya Niğde içi kurye seç.</span>
            </div>
            {minOrderAmount > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Kurye teslimatı için minimum sepet tutarı: <strong>{formatPrice(minOrderAmount)}</strong></span>
              </div>
            )}
            <h2 className="mb-3 text-base font-bold text-slate-900">Teslimat Yöntemi</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['GEL_AL', 'KURYE'] as DeliveryType[]).map(dt => {
                const disabled = dt === 'KURYE' && items.some(i => (i as CartItem & { pickup_only?: boolean }).pickup_only);
                return (
                  <button
                    key={dt}
                    onClick={() => !disabled && setDeliveryType(dt)}
                    disabled={disabled}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50' : deliveryType === dt ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${deliveryType === dt && !disabled ? 'bg-electric-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                      {dt === 'GEL_AL' ? <Store className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-medium text-slate-900">{DELIVERY_TYPE_LABELS[dt]}</span>
                      {disabled && <p className="text-[10px] text-red-500">Sadece dükkandan alınır</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Adres (kurye seçilirse) */}
          {deliveryType === 'KURYE' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Teslimat Adresi</h2>
                <Button size="sm" variant="outline" onClick={() => setShowAddressModal(true)}>
                  <Plus className="h-4 w-4" /> Yeni Adres
                </Button>
              </div>
              {loading ? (
                <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ) : addresses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">Henüz adres eklemediniz.</p>
                  <Button size="sm" className="mt-3" onClick={() => setShowAddressModal(true)}>
                    <Plus className="h-4 w-4" /> Adres Ekle
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses.map(addr => (
                    <button
                      key={addr.id}
                      onClick={() => setSelectedAddress(addr.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${selectedAddress === addr.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selectedAddress === addr.id ? 'border-electric-500 bg-electric-500 text-white' : 'border-slate-300'}`}>
                        {selectedAddress === addr.id && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{addr.title}</p>
                        <p className="text-xs text-slate-500">{addr.neighborhood}, {addr.district}, {addr.city}</p>
                        <p className="text-xs text-slate-500">{addr.street}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Saat aralığı (kurye seçilirse) */}
          {deliveryType === 'KURYE' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-base font-bold text-slate-900">Saat Aralığı</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map(slot => (
                  <button
                    key={slot.id}
                    onClick={() => setDeliverySlotId(slot.id)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-sm transition-all ${deliverySlotId === slot.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{slot.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ödeme yöntemi */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-slate-900">Ödeme Yöntemi</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['cash_on_delivery', 'card_on_delivery', 'bank_transfer'] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  onClick={() => { setPaymentMethod(method); if (method !== 'card_on_delivery') setInstallmentCount(1); }}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${paymentMethod === method ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${paymentMethod === method ? 'bg-electric-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                    {method === 'cash_on_delivery' ? <Banknote className="h-5 w-5" /> : method === 'card_on_delivery' ? <CreditCard className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{paymentMethodLabel(method, deliveryType)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Taksit seçimi - sadece kart seçiliyse */}
          {paymentMethod === 'card_on_delivery' && installments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-base font-bold text-slate-900">Taksit Seçimi</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {installments.map(opt => (
                  <button
                    key={opt.installment_count}
                    onClick={() => setInstallmentCount(opt.installment_count)}
                    className={`rounded-xl border p-2.5 text-sm font-medium transition-all ${installmentCount === opt.installment_count ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {installmentCount > 1 && (() => {
                const sel = installments.find(i => i.installment_count === installmentCount);
                if (!sel) return null;
                const interest = total * sel.interest_rate;
                const grandTotal = total + interest;
                const monthly = grandTotal / installmentCount;
                return (
                  <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Vade Farkı (%{(sel.interest_rate * 100).toFixed(0)}):</span>
                      <span>{formatPrice(interest)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{installmentCount} × Taksit:</span>
                      <span>{formatPrice(monthly)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Toplam:</span>
                      <span className="font-bold">{formatPrice(grandTotal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Not */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-slate-900">Sipariş Notu</h2>
            <Textarea placeholder="Örn: Akşam 18:00'dan sonra getirebilir misiniz?" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        </div>

        {/* Özet */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">Sipariş Özeti</h2>
            <div className="mt-3 space-y-2">
              {items.map(item => (
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span className="text-slate-500">{item.name}{item.variant_storage ? ` (${item.variant_storage})` : ''} <span className="text-slate-400">x{item.quantity}</span></span>
                  <span className="font-medium text-slate-900">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              {paymentMethod === 'card_on_delivery' && installmentCount > 1 && (() => {
                const sel = installments.find(i => i.installment_count === installmentCount);
                if (!sel) return null;
                const interest = total * sel.interest_rate;
                const grandTotal = total + interest;
                return (
                  <>
                    <div className="flex justify-between text-sm text-blue-600">
                      <span>Vade Farkı</span>
                      <span>{formatPrice(interest)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-900">Toplam</span>
                      <span className="text-xl font-bold text-slate-900">{formatPrice(grandTotal)}</span>
                    </div>
                  </>
                );
              })() || (
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-900">Toplam</span>
                  <span className="text-xl font-bold text-slate-900">{formatPrice(total)}</span>
                </div>
              )}
            </div>
            <Button className="mt-4 w-full" size="lg" loading={submitting} onClick={handleSubmit}>
              Siparişi Ver <ArrowRight className="h-4 w-4" />
            </Button>
            <KvkkLink className="mt-3" />
          </div>
        </div>
      </div>

      {/* Adres modal */}
      <Modal open={showAddressModal} onClose={() => setShowAddressModal(false)} title="Yeni Adres Ekle" size="lg">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Adres Başlığı *" value={newAddr.title} onChange={(e) => setNewAddr({ ...newAddr, title: e.target.value })} placeholder="Ev, İş vs." />
          <Input label="Telefon" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} />
          <Input label="İl" value="Niğde" disabled />
          <Input label="İlçe *" value={newAddr.district} onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })} placeholder="Merkez, Bor, Çiftlik vs." />
          <Input label="Mahalle *" value={newAddr.neighborhood} onChange={(e) => setNewAddr({ ...newAddr, neighborhood: e.target.value })} />
          <Input label="Sokak/Cadde *" value={newAddr.street} onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })} />
          <Input label="Bina No" value={newAddr.building_no} onChange={(e) => setNewAddr({ ...newAddr, building_no: e.target.value })} />
          <Input label="Daire No" value={newAddr.apartment_no} onChange={(e) => setNewAddr({ ...newAddr, apartment_no: e.target.value })} />
        </div>
        <div className="mt-3">
          <Textarea label="Adres Tarifi" value={newAddr.directions} onChange={(e) => setNewAddr({ ...newAddr, directions: e.target.value })} rows={2} placeholder="Örn: Karşısında market var" />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowAddressModal(false)}>İptal</Button>
          <Button className="flex-1" onClick={handleAddAddress}>Adresi Kaydet</Button>
        </div>
      </Modal>
    </div>
  );
}
