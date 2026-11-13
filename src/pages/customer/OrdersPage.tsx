import { useEffect, useState } from 'react';
import { Package, ChevronRight, ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, paymentMethodLabel, PAYMENT_STATUS_LABELS } from '@/lib/format';
import type { OrderWithItems } from '@/lib/types';
import { navigate } from '@/lib/router';

type Tab = 'active' | 'past' | 'cancelled';

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadOrders();
  }, [user]);

  const loadOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    setOrders((data as OrderWithItems[]) || []);
    setLoading(false);
  };

  if (!user) return null;

  const filtered = orders.filter((o) => {
    if (tab === 'active') return ['new', 'confirmed', 'preparing', 'shipping'].includes(o.status);
    if (tab === 'past') return o.status === 'delivered';
    return o.status === 'cancelled';
  });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Aktif', count: orders.filter((o) => ['new', 'confirmed', 'preparing', 'shipping'].includes(o.status)).length },
    { key: 'past', label: 'Geçmiş', count: orders.filter((o) => o.status === 'delivered').length },
    { key: 'cancelled', label: 'İptal', count: orders.filter((o) => o.status === 'cancelled').length },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Siparişlerim</h1>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-700">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            {tab === 'active' ? 'Aktif siparişiniz yok.' : tab === 'past' ? 'Geçmiş siparişiniz yok.' : 'İptal edilmiş siparişiniz yok.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <button
              key={order.id}
              onClick={() => navigate(`/order/${order.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                {order.order_items[0]?.image_url ? (
                  <img src={order.order_items[0].image_url} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                ) : (
                  <Package className="h-6 w-6 text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900">{order.order_number}</p>
                  <Badge variant={order.status === 'cancelled' ? 'error' : order.status === 'delivered' ? 'success' : 'amber'}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {order.order_items.length} ürün • {formatDateTime(order.created_at)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {paymentMethodLabel(order.payment_method, order.delivery_type)} • {PAYMENT_STATUS_LABELS[order.payment_status]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{formatPrice(order.total)}</p>
                <ChevronRight className="ml-auto mt-1 h-4 w-4 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
