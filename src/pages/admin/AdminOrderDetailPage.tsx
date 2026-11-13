import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Phone, Mail, Navigation, Package, CreditCard, Banknote, Landmark, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, ORDER_STATUS_FLOW } from '@/lib/format';
import type { OrderWithItems, Address, OrderStatus } from '@/lib/types';
import { navigate } from '@/lib/router';
import { trError } from '@/lib/errors';

export function AdminOrderDetailPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .maybeSingle();
      const ord = data as OrderWithItems | null;
      setOrder(ord);
      if (ord?.address_id) {
        const { data: addr } = await supabase.from('addresses').select('*').eq('id', ord.address_id).maybeSingle();
        setAddress(addr as Address | null);
      }
      setLoading(false);
    })();
  }, [id]);

  const updateStatus = async (status: OrderStatus) => {
    if (updating) return;
    setUpdating(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('set_order_status', { p_order_id: id, p_status: status });
    if (rpcError) {
      setError('Durum güncellenemedi: ' + trError(rpcError));
      setUpdating(false);
      return;
    }
    const { data } = await supabase.from('orders').select('*, order_items(*, variant:product_variants(storage))').eq('id', id).maybeSingle();
    setOrder(data as OrderWithItems | null);
    setUpdating(false);
  };

  const updatePayment = async (paid: boolean) => {
    if (updating) return;
    setUpdating(true);
    setError('');
    const { error: updateError } = await supabase.from('orders').update({ payment_status: paid ? 'paid' : 'pending' }).eq('id', id);
    if (updateError) {
      setError('Ödeme durumu güncellenemedi: ' + trError(updateError));
      setUpdating(false);
      return;
    }
    const { data } = await supabase.from('orders').select('*, order_items(*, variant:product_variants(storage))').eq('id', id).maybeSingle();
    setOrder(data as OrderWithItems | null);
    setUpdating(false);
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Sipariş bulunamadı.</p>
        <Button className="mt-4" onClick={() => navigate('/admin/orders')}>Siparişlere Dön</Button>
      </div>
    );
  }

  const fullAddress = address
    ? `${address.neighborhood}, ${address.street}, ${address.district}, ${address.city}`
    : '';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <div>
      <button onClick={() => navigate('/admin/orders')} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Siparişlere Dön
      </button>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{order.order_number}</h1>
          <p className="mt-1 text-sm text-slate-500">{formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="amber">{ORDER_STATUS_LABELS[order.status]}</Badge>
          <Badge variant={order.payment_status === 'paid' ? 'success' : 'default'}>
            {PAYMENT_STATUS_LABELS[order.payment_status]}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Timeline + status actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-slate-900">Sipariş Durumu</h2>
            <OrderTimeline status={order.status} />
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Durumu Değiştir:</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUS_FLOW.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={updating || order.status === s || (order.status === 'delivered' && s !== 'delivered')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      order.status === s
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } disabled:opacity-50`}
                  >
                    {ORDER_STATUS_LABELS[s]}
                  </button>
                ))}
                {order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <button
                    onClick={() => updateStatus('cancelled')}
                    disabled={updating}
                    className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
                  >
                    İptal Et
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-slate-900">Ürünler</h2>
            <div className="space-y-3">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain p-1" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                    {item.variant?.storage && <p className="text-xs font-medium text-slate-600">Hafıza: {item.variant.storage}</p>}
                    <p className="text-xs text-slate-500">{item.brand} {item.model}</p>
                    <p className="text-xs text-slate-400">{formatPrice(item.unit_price)} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{formatPrice(item.subtotal)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3">
              <span className="font-semibold text-slate-900">Toplam</span>
              <span className="text-lg font-bold text-slate-900">{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Note */}
          {order.note && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-2 text-base font-bold text-slate-900">Müşteri Notu</h2>
              <p className="text-sm text-slate-600">{order.note}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-slate-900">Müşteri Bilgileri</h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-900">{order.customer_name}</p>
              <div className="flex items-center gap-2 text-slate-500">
                <Mail className="h-4 w-4" /> {order.customer_email}
              </div>
              {order.customer_phone && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Phone className="h-4 w-4" /> {order.customer_phone}
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          {address && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-slate-400" /> Teslimat Adresi
              </h2>
              <p className="text-sm font-semibold text-slate-900">{address.title}</p>
              <p className="mt-1 text-sm text-slate-600">{address.neighborhood}, {address.street}</p>
              <p className="text-sm text-slate-600">{address.district}, {address.city}</p>
              {address.building_no && <p className="text-sm text-slate-500">Bina No: {address.building_no}</p>}
              {address.apartment_no && <p className="text-sm text-slate-500">Daire No: {address.apartment_no}</p>}
              {address.directions && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-500">{address.directions}</p>}
              {address.phone && <p className="mt-1 text-sm text-slate-500">Tel: {address.phone}</p>}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Navigation className="h-4 w-4" /> Yol Tarifi Al
              </a>
            </div>
          )}

          {/* Payment */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-slate-900">Ödeme</h2>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {(order.payment_method === 'cash_on_delivery' || order.payment_method === 'cash') ? <Banknote className="h-4 w-4" /> : order.payment_method === 'bank_transfer' ? <Landmark className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              {PAYMENT_METHOD_LABELS[order.payment_method]}
            </div>
            <p className={`mt-2 text-sm font-medium ${order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {PAYMENT_STATUS_LABELS[order.payment_status]}
            </p>

            {/* Taksit bilgisi */}
            {order.installment_count && order.installment_count > 1 && (
              <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm">
                <p className="font-bold text-blue-900">Taksit Bilgisi</p>
                <div className="mt-1 space-y-1 text-blue-700">
                  <div className="flex justify-between">
                    <span>Taksit Sayısı:</span>
                    <span className="font-medium">{order.installment_count} Taksit</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aylık Tutar:</span>
                    <span className="font-medium">{formatPrice(order.installment_monthly_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Müşteri Toplamı:</span>
                    <span className="font-medium">{formatPrice(order.installment_total || 0)}</span>
                  </div>
                  {order.interest_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Vade Farkı:</span>
                      <span>{formatPrice(order.interest_amount)}</span>
                    </div>
                  )}
                  {order.pos_commission_amount > 0 && (
                    <div className="flex justify-between border-t border-blue-200 pt-1">
                      <span>POS Komisyonu:</span>
                      <span className="text-red-600">{formatPrice(order.pos_commission_amount)}</span>
                    </div>
                  )}
                  {order.net_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Net Tutar:</span>
                      <span className="font-bold">{formatPrice(order.net_amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {order.payment_status === 'pending' && (
              <Button size="sm" variant="success" className="mt-3 w-full" onClick={() => updatePayment(true)} disabled={updating}>
                <CheckCircle className="h-4 w-4" /> Ödemeyi Alındı İşaretle
              </Button>
            )}
            {order.payment_status === 'paid' && order.status !== 'delivered' && (
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => updatePayment(false)} disabled={updating}>
                Ödemeyi Geri Al
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
