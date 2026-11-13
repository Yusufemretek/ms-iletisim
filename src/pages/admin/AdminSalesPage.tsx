import { useEffect, useState } from 'react';
import { TrendingUp, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/format';
import type { Sale } from '@/lib/types';

export function AdminSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      setSales((data as Sale[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = sales.filter((s) =>
    !search || s.product_name.toLowerCase().includes(search.toLowerCase()) || s.order_id.toLowerCase().includes(search.toLowerCase()),
  );

  const totalRevenue = filtered.reduce((s, r) => s + Number(r.total_sale), 0);
  const totalProfit = filtered.reduce((s, r) => s + Number(r.profit), 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Satışlar</h1>
        <p className="mt-1 text-sm text-slate-500">Teslim edilen siparişlerden oluşan satış kayıtları</p>
      </div>

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Toplam Satış</p>
          <p className="text-lg font-bold text-slate-900">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Toplam Kâr</p>
          <p className="text-lg font-bold text-slate-900">{formatPrice(totalProfit)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Satış Adedi</p>
          <p className="text-lg font-bold text-slate-900">{filtered.length}</p>
        </div>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Ürün veya sipariş ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Satış kaydı yok.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Ürün</th>
                <th className="p-3 font-medium">Adet</th>
                <th className="p-3 font-medium">Alış</th>
                <th className="p-3 font-medium">Satış</th>
                <th className="p-3 font-medium">Kâr</th>
                <th className="p-3 font-medium">Ödeme</th>
                <th className="p-3 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => (
                <tr key={sale.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-900">{sale.product_name}</td>
                  <td className="p-3 text-slate-600">{sale.quantity}</td>
                  <td className="p-3 text-slate-500">{formatPrice(sale.cost_price)}</td>
                  <td className="p-3 font-medium text-slate-900">{formatPrice(sale.sale_price)}</td>
                  <td className="p-3 font-medium text-emerald-600">{formatPrice(sale.profit)}</td>
                  <td className="p-3 text-slate-500">{sale.payment_method ? PAYMENT_METHOD_LABELS[sale.payment_method] || sale.payment_method : '-'}</td>
                  <td className="p-3 text-slate-400">{formatDate(sale.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
