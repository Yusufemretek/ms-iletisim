import { useEffect, useState } from 'react';
import { Search, ShoppingCart, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';
import { navigate } from '@/lib/router';

type OrderTab = 'active' | 'past' | 'all';

const tabConfig: { key: OrderTab; label: string; statuses: OrderStatus[] | null }[] = [
  { key: 'active', label: 'Aktif', statuses: ['new', 'confirmed', 'preparing', 'shipping'] },
  { key: 'past', label: 'Geçmiş', statuses: ['delivered', 'cancelled'] },
  { key: 'all', label: 'Tümü', statuses: null },
];

const statusFilters: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'new', label: 'Yeni' },
  { key: 'confirmed', label: 'Onaylandı' },
  { key: 'preparing', label: 'Hazırlanıyor' },
  { key: 'shipping', label: 'Teslimatta' },
  { key: 'delivered', label: 'Teslim Edildi' },
  { key: 'cancelled', label: 'İptal' },
];

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OrderTab>('active');
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  };

  const tabStatuses = tabConfig.find(t => t.key === tab)?.statuses;
  const filtered = orders.filter((o) => {
    if (tabStatuses && !tabStatuses.includes(o.status)) return false;
    if (filter !== 'all' && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Siparişler</h1>
        <p className="mt-1 text-sm text-slate-500">{filtered.length} sipariş</p>
      </div>

      {/* Tab separator: Aktif / Geçmiş / Tümü */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabConfig.map(t => {
          const count = t.statuses ? orders.filter(o => t.statuses!.includes(o.status)).length : orders.length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-700">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Sipariş no, müşteri adı veya e-posta ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Sipariş bulunamadı.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Sipariş No</th>
                <th className="p-3 font-medium">Müşteri</th>
                <th className="p-3 font-medium">Tutar</th>
                <th className="p-3 font-medium">Ödeme</th>
                <th className="p-3 font-medium">Durum</th>
                <th className="p-3 font-medium">Tarih</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} onClick={() => navigate(`/admin/orders/${order.id}`)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-900">{order.order_number}</td>
                  <td className="p-3">
                    <p className="text-slate-900">{order.customer_name}</p>
                    <p className="text-xs text-slate-400">{order.customer_email}</p>
                  </td>
                  <td className="p-3 font-medium text-slate-900">{formatPrice(order.total)}</td>
                  <td className="p-3">
                    <p className="text-slate-600">{PAYMENT_METHOD_LABELS[order.payment_method]}</p>
                    <p className={`text-xs ${order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {PAYMENT_STATUS_LABELS[order.payment_status]}
                    </p>
                  </td>
                  <td className="p-3">
                    <Badge variant={order.status === 'cancelled' ? 'error' : order.status === 'delivered' ? 'success' : 'amber'}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-slate-400">{formatDateTime(order.created_at)}</td>
                  <td className="p-3"><ChevronRight className="h-4 w-4 text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
