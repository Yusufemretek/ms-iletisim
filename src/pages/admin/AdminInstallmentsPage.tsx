import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Save, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/format';
import type { InstallmentSetting } from '@/lib/types';
import { trError } from '@/lib/errors';

export function AdminInstallmentsPage() {
  const [settings, setSettings] = useState<InstallmentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('installment_settings').select('*').order('sort_order');
    setSettings((data as InstallmentSetting[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (id: number, field: keyof InstallmentSetting, value: boolean | number) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, [field]: value } as InstallmentSetting : s));
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const payload = settings.map(s => ({
      installment_count: s.installment_count,
      is_active: s.is_active,
      interest_rate: s.interest_rate,
      commission_rate: s.commission_rate,
    }));
    const { error: err } = await supabase.rpc('update_installment_settings', { p_settings: payload });
    setSaving(false);
    if (err) { setError(trError(err)); return; }
    setSuccess('Taksit ayarları güncellendi');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <CreditCard className="h-6 w-6 text-blue-600" /> Kredi Kartı Taksitleri
          </h1>
          <p className="mt-1 text-sm text-slate-500">Taksit seçeneklerini, vade farkı ve komisyon oranlarını yönetin</p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save className="h-4 w-4" /> Kaydet
        </Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="p-3 font-medium">Taksit</th>
              <th className="p-3 font-medium">Aktif</th>
              <th className="p-3 font-medium">Vade Farkı (%)</th>
              <th className="p-3 font-medium">Komisyon Oranı (%)</th>
              <th className="p-3 font-medium">Örnek (30.000 ₺)</th>
            </tr>
          </thead>
          <tbody>
            {settings.map(s => {
              const exampleInterest = 30000 * s.interest_rate;
              const exampleTotal = 30000 + exampleInterest;
              const exampleMonthly = exampleTotal / s.installment_count;
              return (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-900">{s.label}</td>
                  <td className="p-3">
                    <button
                      onClick={() => updateField(s.id, 'is_active', !s.is_active)}
                      className={`flex h-6 w-11 items-center rounded-full transition-colors ${s.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${s.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="p-3">
                    <input
                      type="number" placeholder="0"
                      step="0.01"
                      min="0"
                      value={s.interest_rate * 100}
                      onChange={(e) => updateField(s.id, 'interest_rate', Number(e.target.value) / 100)}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number" placeholder="0"
                      step="0.01"
                      min="0"
                      value={s.commission_rate * 100}
                      onChange={(e) => updateField(s.id, 'commission_rate', Number(e.target.value) / 100)}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="p-3 text-slate-500">
                    {s.installment_count > 1
                      ? `${s.installment_count} × ${formatPrice(exampleMonthly)} (Toplam: ${formatPrice(exampleTotal)})`
                      : `Tek Çekim: ${formatPrice(30000)}`
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
        <p className="font-bold">Önemli Notlar</p>
        <ul className="mt-2 space-y-1 text-blue-600">
          <li>• Taksit yalnızca kredi kartı ödemelerinde geçerlidir. Nakit, havale ve IBAN'da taksit gösterilmez.</li>
          <li>• Pasif yapılan taksitler müşteriye gösterilmez.</li>
          <li>• Vade farkı, taksit tutarına eklenir. Komisyon oranı, gün sonu kart bakiyesinden düşülür.</li>
          <li>• Oranlar veritabanında saklanır, kod içine sabit yazılmaz.</li>
        </ul>
      </div>
    </div>
  );
}
