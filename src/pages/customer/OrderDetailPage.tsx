import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, XCircle, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OrderTimeline } from '@/components/OrderTimeline';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, paymentMethodLabel, PAYMENT_STATUS_LABELS } from '@/lib/format';
import type { OrderWithItems, Address } from '@/lib/types';
import { navigate } from '@/lib/router';
import { trError } from '@/lib/errors';

export function OrderDetailPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, variant:product_variants(storage))')
        .eq('id', id)
        .maybeSingle();
      const ord = data as OrderWithItems | null;
      setOrder(ord);
      if (ord?.address_id) {
        const { data: addr } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', ord.address_id)
          .maybeSingle();
        setAddress(addr as Address | null);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError('');
    const { error } = await supabase.rpc('cancel_my_order', { p_order_id: id });
    if (error) {
      setCancelError(trError(error));
      setCancelling(false);
      return;
    }
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .maybeSingle();
    setOrder(data as OrderWithItems | null);
    setCancelOpen(false);
    setCancelling(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-slate-500">Sipariş bulunamadı.</p>
        <Button className="mt-4" onClick={() => navigate('/orders')}>
          Siparişlerime Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <button
        onClick={() => navigate('/orders')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Siparişlerime Dön
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

      {order.status === 'new' && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Siparişiniz henüz onaylanmadı</p>
              <p className="text-xs text-amber-700">Siparişiniz onaylanmadan iptal edebilirsiniz.</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
            <XCircle className="h-4 w-4" /> Siparişi İptal Et
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-slate-900">Sipariş Durumu</h2>
            <OrderTimeline status={order.status} />
          </div>

          {/* Items */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-slate-900">Ürünler</h2>
            <div className="space-y-3">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
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
                    {item.brand && <p className="text-xs text-slate-500">{item.brand} {item.model}</p>}
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
              <h2 className="mb-2 text-base font-bold text-slate-900">Sipariş Notu</h2>
              <p className="text-sm text-slate-600">{order.note}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Payment */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-slate-900">Ödeme Bilgileri</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Yöntem</span>
                <span className="font-medium text-slate-900">{paymentMethodLabel(order.payment_method, order.delivery_type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Durum</span>
                <span className={`font-medium ${order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {PAYMENT_STATUS_LABELS[order.payment_status]}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="font-semibold text-slate-900">Tutar</span>
                <span className="font-bold text-slate-900">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Address */}
          {address && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-slate-400" />
                Teslimat Adresi
              </h2>
              <p className="text-sm font-semibold text-slate-900">{address.title}</p>
              <p className="mt-1 text-sm text-slate-600">
                {address.neighborhood}, {address.street}
              </p>
              <p className="text-sm text-slate-600">
                {address.district}, {address.city}
              </p>
              {address.building_no && <p className="text-sm text-slate-500">Bina No: {address.building_no}</p>}
              {address.apartment_no && <p className="text-sm text-slate-500">Daire No: {address.apartment_no}</p>}
              {address.directions && <p className="mt-1 text-sm text-slate-400">{address.directions}</p>}
              {address.phone && <p className="mt-1 text-sm text-slate-500">Tel: {address.phone}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Siparişi İptal Et" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <strong>{order.order_number}</strong> numaralı siparişinizi iptal etmek üzeredesiniz.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Sipariş iptal edildiğinde ürünler stoka geri eklenecek ve siparişiniz geri alınamayacak. Bu işlem geri alınamaz.
            </p>
          </div>
          {cancelError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {cancelError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Vazgeç
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              <XCircle className="h-4 w-4" /> Evet, İptal Et
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
