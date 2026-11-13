import { useEffect, useState } from 'react';
import { Package, TrendingUp, Clock, Truck, Wallet, Building2, CreditCard, Receipt, BarChart3, Wrench, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, SALES_CHANNEL_LABELS } from '@/lib/format';
import { navigate } from '@/lib/router';
import type { Order, FinancialSummary } from '@/lib/types';

export function AdminDashboard() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: summaryData }, { data: recentOrdersData }] = await Promise.all([
        supabase.rpc('get_financial_summary'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(8),
      ]);
      setSummary(summaryData as FinancialSummary);
      setRecentOrders((recentOrdersData as Order[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading || !summary) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      </div>
    );
  }

  const balanceCards = [
    { label: 'Kasa Bakiyesi', value: summary.cash_balance, icon: Wallet, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Banka Bakiyesi', value: summary.bank_balance, icon: Building2, color: 'bg-blue-100 text-blue-600' },
    { label: 'Kart Bakiyesi', value: summary.card_balance, icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
  ];

  const todayCards = [
    { label: 'Bugünkü Satış', value: formatPrice(summary.today_sales), icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Bugünkü Maliyet', value: formatPrice(summary.today_cost), icon: Package, color: 'bg-red-100 text-red-600' },
    { label: 'Ürün Kârı', value: formatPrice(summary.today_profit), icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'POS Komisyon', value: formatPrice(summary.today_commission), icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
    { label: 'Bugünkü Gider', value: formatPrice(summary.today_expenses), icon: Receipt, color: 'bg-red-100 text-red-600' },
    { label: 'Net Kâr', value: formatPrice(summary.net_profit), icon: BarChart3, color: summary.net_profit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600', highlight: true },
  ];

  const statusCards = [
    { label: 'Bekleyen Sipariş', value: summary.pending_orders, icon: Clock, color: 'bg-amber-100 text-amber-600', path: '/admin/orders' },
    { label: 'Bekleyen Servis', value: summary.pending_services, icon: Wrench, color: 'bg-blue-100 text-blue-600', path: '/admin/services' },
    { label: 'Kurye Teslimat', value: summary.courier_deliveries, icon: Truck, color: 'bg-purple-100 text-purple-600', path: '/admin/deliveries' },
    { label: 'Düşük Stok', value: summary.low_stock_count, icon: AlertTriangle, color: 'bg-red-100 text-red-600', path: '/admin/products' },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mb-5 text-sm text-slate-500">Genel durum ve finansal özet</p>

      {/* Hesap Bakiyeleri */}
      <h2 className="mb-2 text-sm font-bold text-slate-700">Hesap Bakiyeleri</h2>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {balanceCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate('/admin/finance')}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs text-slate-500">{card.label}</p>
            <p className={`text-xl font-bold ${card.value >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{formatPrice(card.value)}</p>
          </button>
        ))}
      </div>

      {/* Bugünkü Özet */}
      <h2 className="mb-2 text-sm font-bold text-slate-700">Bugünkü Özet</h2>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {todayCards.map(card => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 ${card.highlight ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs text-slate-500">{card.label}</p>
            <p className={`text-lg font-bold ${card.label === 'Net Kâr' ? (summary.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-900'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Durum Kartları */}
      <h2 className="mb-2 text-sm font-bold text-slate-700">Operasyonel Durum</h2>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statusCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.path)}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs text-slate-500">{card.label}</p>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
          </button>
        ))}
      </div>

      {/* Ek bilgiler */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Toplam Stok Değeri</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatPrice(summary.total_stock_value)}</p>
        </div>
      </div>

      {/* Son Siparişler */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-base font-bold text-slate-900">Son Siparişler</h2>
          <button onClick={() => navigate('/admin/orders')} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Tümünü Gör
          </button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Henüz sipariş yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="p-3 font-medium">Sipariş No</th>
                  <th className="p-3 font-medium">Müşteri</th>
                  <th className="p-3 font-medium">Kanal</th>
                  <th className="p-3 font-medium">Tutar</th>
                  <th className="p-3 font-medium">Ödeme</th>
                  <th className="p-3 font-medium">Durum</th>
                  <th className="p-3 font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                  >
                    <td className="p-3 font-medium text-slate-900">{order.order_number}</td>
                    <td className="p-3 text-slate-600">{order.customer_name}</td>
                    <td className="p-3">
                      <Badge variant="default">{SALES_CHANNEL_LABELS[order.sales_channel] || order.sales_channel}</Badge>
                    </td>
                    <td className="p-3 font-medium text-slate-900">{formatPrice(order.total)}</td>
                    <td className="p-3 text-slate-500">{PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method}</td>
                    <td className="p-3">
                      <Badge variant={order.status === 'cancelled' ? 'error' : order.status === 'delivered' ? 'success' : 'amber'}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-400">{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
