import { useEffect, useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Package, Smartphone, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import type { Sale, Order } from '@/lib/types';

type Range = 'today' | 'week' | 'month' | 'all';

export function AdminReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: salesData }, { data: ordersData }] = await Promise.all([
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*'),
      ]);
      setSales((salesData as Sale[]) || []);
      setOrders((ordersData as Order[]) || []);
      setLoading(false);
    })();
  }, []);

  const dateRange = useMemo(() => {
    if (startDate && endDate) {
      return { start: new Date(startDate), end: new Date(endDate + 'T23:59:59') };
    }
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    if (range === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start, end: now };
    }
    if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }
    return { start: new Date(0), end: now };
  }, [range, startDate, endDate]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [sales, dateRange]);

  const totalRevenue = filteredSales.reduce((s, r) => s + Number(r.total_sale), 0);
  const totalProfit = filteredSales.reduce((s, r) => s + Number(r.profit), 0);
  const cancelledOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    return o.status === 'cancelled' && d >= dateRange.start && d <= dateRange.end;
  });

  // Top products
  const productAgg: Record<string, { name: string; qty: number; revenue: number }> = {};
  filteredSales.forEach((s) => {
    if (!productAgg[s.product_name]) productAgg[s.product_name] = { name: s.product_name, qty: 0, revenue: 0 };
    productAgg[s.product_name].qty += s.quantity;
    productAgg[s.product_name].revenue += Number(s.total_sale);
  });
  const topProducts = Object.values(productAgg).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Top phones
  const topPhones = Object.values(productAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
  }

  const rangeOptions: { key: Range; label: string }[] = [
    { key: 'today', label: 'Bugün' },
    { key: 'week', label: 'Bu Hafta' },
    { key: 'month', label: 'Bu Ay' },
    { key: 'all', label: 'Tümü' },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Raporlar</h1>
        <p className="mt-1 text-sm text-slate-500">Satış ve performans raporları</p>
      </div>

      {/* Date filter */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {rangeOptions.map((r) => (
            <button
              key={r.key}
              onClick={() => { setRange(r.key); setStartDate(''); setEndDate(''); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${range === r.key && !startDate ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {r.label}
            </button>
          ))}
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <span className="text-slate-400">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
          <p className="mt-3 text-xs text-slate-500">Toplam Satış</p>
          <p className="text-lg font-bold text-slate-900">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><TrendingUp className="h-5 w-5" /></div>
          <p className="mt-3 text-xs text-slate-500">Toplam Kâr</p>
          <p className="text-lg font-bold text-slate-900">{formatPrice(totalProfit)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><Package className="h-5 w-5" /></div>
          <p className="mt-3 text-xs text-slate-500">Satılan Ürün</p>
          <p className="text-lg font-bold text-slate-900">{filteredSales.reduce((s, r) => s + r.quantity, 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"><XCircle className="h-5 w-5" /></div>
          <p className="mt-3 text-xs text-slate-500">İptal Edilen</p>
          <p className="text-lg font-bold text-slate-900">{cancelledOrders.length}</p>
        </div>
      </div>

      {/* Top products */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
            <BarChart3 className="h-5 w-5 text-slate-400" /> En Çok Satılan Ürünler
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-400">Veri yok.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.qty} adet satıldı</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{formatPrice(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
            <Smartphone className="h-5 w-5 text-slate-400" /> En Yüksek Cirolu Ürünler
          </h2>
          {topPhones.length === 0 ? (
            <p className="text-sm text-slate-400">Veri yok.</p>
          ) : (
            <div className="space-y-2">
              {topPhones.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.qty} adet</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{formatPrice(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancelled orders */}
      {cancelledOrders.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
            <XCircle className="h-5 w-5 text-red-500" /> İptal Edilen Siparişler
          </h2>
          <div className="space-y-2">
            {cancelledOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl bg-red-50 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{o.order_number}</p>
                  <p className="text-xs text-slate-500">{o.customer_name} • {formatDate(o.created_at)}</p>
                </div>
                <span className="text-sm font-bold text-slate-900">{formatPrice(o.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
