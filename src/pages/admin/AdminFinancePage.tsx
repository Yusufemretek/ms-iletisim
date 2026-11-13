import { useEffect, useState, useCallback } from 'react';
import { Wallet, Building2, CreditCard, Plus, TrendingUp, TrendingDown, Calendar, Receipt, BarChart3, Banknote } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { formatPrice, formatDateTime, formatDate, EXPENSE_CATEGORIES } from '@/lib/format';
import type { FinancialSummary, Expense, DailyClosing } from '@/lib/types';
import { trError } from '@/lib/errors';

export function AdminFinancePage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'expenses' | 'closings'>('overview');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Expense form
  const [expCategory, setExpCategory] = useState('Kira');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState(0);
  const [expPaymentType, setExpPaymentType] = useState('KASA');

  // Closing form
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10));

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: summaryData }, { data: expData }, { data: closingData }] = await Promise.all([
      supabase.rpc('get_financial_summary'),
      supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('daily_closings').select('*').order('closing_date', { ascending: false }).limit(30),
    ]);
    setSummary(summaryData as FinancialSummary);
    setExpenses((expData as Expense[]) || []);
    setClosings((closingData as DailyClosing[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddExpense = async () => {
    if (saving) return;
    setError('');
    if (expAmount <= 0) { setError('Tutar 0 dan büyük olmalı'); return; }
    setSaving(true);
    const { error: err } = await supabase.rpc('add_expense', {
      p_category: expCategory,
      p_description: expDescription || null,
      p_amount: expAmount,
      p_payment_type: expPaymentType,
    });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setSuccess('Gider eklendi');
    setShowExpenseModal(false);
    setExpDescription('');
    setExpAmount(0);
    loadAll();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDailyClosing = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    const { error: err } = await supabase.rpc('run_daily_closing', {
      p_closing_date: closingDate,
    });
    setSaving(false);
    if (err) {
      setError('Gün sonu hatası: ' + trError(err));
      return;
    }
    setSuccess('Gün sonu başarıyla yapıldı');
    setShowClosingModal(false);
    loadAll();
    setTimeout(() => setSuccess(''), 4000);
  };

  if (loading || !summary) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}
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
    { label: 'Bugünkü Satış', value: summary.today_sales, icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Bugünkü Nakit', value: summary.today_cash, icon: Banknote, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Bugünkü Kart', value: summary.today_card, icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
    { label: 'Bugünkü Havale', value: summary.today_bank, icon: Building2, color: 'bg-blue-100 text-blue-600' },
    { label: 'Bugünkü Maliyet', value: summary.today_cost, icon: TrendingDown, color: 'bg-red-100 text-red-600' },
    { label: 'Bugünkü Ürün Kârı', value: summary.today_profit, icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Bugünkü Gider', value: summary.today_expenses, icon: Receipt, color: 'bg-red-100 text-red-600' },
    { label: 'Bugünkü Net Kâr', value: summary.net_profit, icon: BarChart3, color: summary.net_profit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600' },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finans</h1>
          <p className="mt-1 text-sm text-slate-500">Kasa, banka, kart ve kâr/zarar yönetimi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowExpenseModal(true)}>
            <Plus className="h-4 w-4" /> Gider Ekle
          </Button>
          <Button variant="secondary" onClick={() => setShowClosingModal(true)}>
            <Calendar className="h-4 w-4" /> Gün Sonu
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      {/* Tab seçici */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {([
          { key: 'overview', label: 'Genel Bakış' },
          { key: 'expenses', label: 'Giderler' },
          { key: 'closings', label: 'Gün Sonu' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Bakiye kartları */}
          <h2 className="mb-2 text-sm font-bold text-slate-700">Hesap Bakiyeleri</h2>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {balanceCards.map(card => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs text-slate-500">{card.label}</p>
                <p className={`text-xl font-bold ${card.value >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{formatPrice(card.value)}</p>
              </div>
            ))}
          </div>

          {/* Bugünkü kartlar */}
          <h2 className="mb-2 text-sm font-bold text-slate-700">Bugünkü Özet</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {todayCards.map(card => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs text-slate-500">{card.label}</p>
                <p className={`text-lg font-bold ${card.label.includes('Kâr') || card.label.includes('Satış') ? (card.value >= 0 ? 'text-slate-900' : 'text-red-600') : (card.label.includes('Gider') || card.label.includes('Maliyet')) ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatPrice(card.value)}
                </p>
              </div>
            ))}
          </div>

          {/* Ek bilgiler */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Toplam Stok Değeri</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatPrice(summary.total_stock_value)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Düşük Stok Uyarısı</p>
              <p className="mt-1 text-lg font-bold text-amber-600">{summary.low_stock_count} ürün</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Bekleyen Sipariş</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{summary.pending_orders}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Bekleyen Servis</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{summary.pending_services}</p>
            </div>
          </div>
        </>
      )}

      {tab === 'expenses' && (
        <div>
          {expenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Receipt className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Gider kaydı yok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="p-3 font-medium">Kategori</th>
                    <th className="p-3 font-medium">Açıklama</th>
                    <th className="p-3 font-medium">Tutar</th>
                    <th className="p-3 font-medium">Ödeme</th>
                    <th className="p-3 font-medium">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{exp.category}</td>
                      <td className="p-3 text-slate-500">{exp.description || '-'}</td>
                      <td className="p-3 font-medium text-red-600">-{formatPrice(exp.amount)}</td>
                      <td className="p-3 text-slate-500">{exp.payment_type}</td>
                      <td className="p-3 text-slate-400">{formatDateTime(exp.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'closings' && (
        <div>
          {closings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Gün sonu kaydı yok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="p-3 font-medium">Tarih</th>
                    <th className="p-3 font-medium">Nakit</th>
                    <th className="p-3 font-medium">Kart</th>
                    <th className="p-3 font-medium">Havale</th>
                    <th className="p-3 font-medium">Satış</th>
                    <th className="p-3 font-medium">Maliyet</th>
                    <th className="p-3 font-medium">Ürün Kârı</th>
                    <th className="p-3 font-medium">Komisyon</th>
                    <th className="p-3 font-medium">Gider</th>
                    <th className="p-3 font-medium">Net Kâr</th>
                    <th className="p-3 font-medium">Başlangıç Kasası</th>
                    <th className="p-3 font-medium">Bitiş Kasası</th>
                  </tr>
                </thead>
                <tbody>
                  {closings.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{formatDate(c.closing_date)}</td>
                      <td className="p-3 text-slate-600">{formatPrice(c.cash_total)}</td>
                      <td className="p-3 text-slate-600">{formatPrice(c.card_total)}</td>
                      <td className="p-3 text-slate-600">{formatPrice(c.bank_total)}</td>
                      <td className="p-3 font-medium text-slate-900">{formatPrice(c.total_sales)}</td>
                      <td className="p-3 text-red-600">{formatPrice(c.total_cost)}</td>
                      <td className="p-3 font-medium text-emerald-600">{formatPrice(c.gross_profit)}</td>
                      <td className="p-3 text-red-600">{formatPrice(c.pos_commission)}</td>
                      <td className="p-3 text-red-600">{formatPrice(c.expenses_total)}</td>
                      <td className={`p-3 font-bold ${c.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPrice(c.net_profit)}</td>
                      <td className="p-3 text-slate-500">{formatPrice(c.starting_cash)}</td>
                      <td className="p-3 text-slate-500">{formatPrice(c.ending_cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Gider Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Gider Ekle</h2>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              <Select label="Kategori" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Textarea label="Açıklama" value={expDescription} onChange={(e) => setExpDescription(e.target.value)} rows={2} placeholder="Gider açıklaması" />
              <Input label="Tutar (₺)" type="number" min={0} value={expAmount} onChange={(e) => setExpAmount(Number(e.target.value))} />
              <Select label="Ödeme Yöntemi" value={expPaymentType} onChange={(e) => setExpPaymentType(e.target.value)}>
                <option value="KASA">Kasa</option>
                <option value="BANKA">Banka</option>
                <option value="KART">Kart</option>
              </Select>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowExpenseModal(false)}>İptal</Button>
              <Button className="flex-1" loading={saving} onClick={handleAddExpense}>Kaydet</Button>
            </div>
          </div>
        </div>
      )}

      {/* Gün Sonu Modal */}
      {showClosingModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowClosingModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Gün Sonu</h2>
            <p className="mb-4 text-sm text-slate-500">
              Gün sonu işlemi kart bakiyesini %0,99 POS komisyonu ile bankaya aktarır. Bu işlem geri alınamaz ve aynı gün için tekrar yapılamaz.
            </p>
            <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm">
              <div className="flex justify-between text-amber-700">
                <span>Kart Bakiyesi:</span>
                <span className="font-bold">{formatPrice(summary.card_balance)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Tahmini Komisyon (%0,99):</span>
                <span className="font-bold">{formatPrice(summary.card_balance * 0.0099)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Bankaya Aktarılacak:</span>
                <span className="font-bold">{formatPrice(summary.card_balance * (1 - 0.0099))}</span>
              </div>
            </div>
            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <Input label="Tarih" type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowClosingModal(false)}>İptal</Button>
              <Button variant="danger" className="flex-1" loading={saving} onClick={handleDailyClosing}>
                <Calendar className="h-4 w-4" />
                Gün Sonu Yap
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
