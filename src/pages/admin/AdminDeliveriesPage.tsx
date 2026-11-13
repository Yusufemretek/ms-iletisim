import { useEffect, useState } from 'react';
import { Truck, MapPin, Navigation, Phone, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/format';
import type { Order, Address } from '@/lib/types';
import { navigate } from '@/lib/router';

export function AdminDeliveriesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Record<string, Address>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['preparing', 'shipping'])
        .order('created_at', { ascending: false });
      const orderList = (data as Order[]) || [];
      setOrders(orderList);
      // Load addresses
      if (orderList.length > 0) {
        const addrIds = orderList.map((o) => o.address_id).filter(Boolean) as string[];
        const { data: addrs } = await supabase.from('addresses').select('*').in('id', addrIds);
        const addrMap: Record<string, Address> = {};
        (addrs as Address[] || []).forEach((a) => { addrMap[a.id] = a; });
        setAddresses(addrMap);
      }
      setLoading(false);
    })();
  }, []);

  const updateStatus = async (orderId: string, status: 'shipping' | 'delivered') => {
    await supabase.rpc('set_order_status', { p_order_id: orderId, p_status: status });
    // Reload
    const { data } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['preparing', 'shipping'])
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
  };

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Teslimatlar</h1>
        <p className="mt-1 text-sm text-slate-500">Hazırlanan ve teslimattaki siparişler</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Truck className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Aktif teslimat yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const addr = order.address_id ? addresses[order.address_id] : null;
            const fullAddress = addr ? `${addr.neighborhood}, ${addr.street}, ${addr.district}, ${addr.city}` : '';
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

            return (
              <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{order.order_number}</p>
                      <Badge variant={order.status === 'shipping' ? 'info' : 'amber'}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{order.customer_name}</p>
                    {order.customer_phone && (
                      <p className="flex items-center gap-1 text-sm text-slate-500">
                        <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">{formatDateTime(order.created_at)} • {formatPrice(order.total)} • {PAYMENT_METHOD_LABELS[order.payment_method]}</p>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'preparing' && (
                      <Button size="sm" variant="primary" onClick={() => updateStatus(order.id, 'shipping')}>
                        <Truck className="h-4 w-4" /> Teslimata Çıkar
                      </Button>
                    )}
                    {order.status === 'shipping' && (
                      <Button size="sm" variant="success" onClick={() => updateStatus(order.id, 'delivered')}>
                        Teslim Edildi
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                      Detay <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {addr && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{addr.title}</p>
                          <p className="text-sm text-slate-600">{addr.neighborhood}, {addr.street}</p>
                          <p className="text-sm text-slate-600">{addr.district}, {addr.city}</p>
                          {addr.directions && <p className="mt-1 text-xs text-slate-400">{addr.directions}</p>}
                        </div>
                      </div>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <Navigation className="h-3.5 w-3.5" /> Yol Tarifi
                      </a>
                    </div>
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
