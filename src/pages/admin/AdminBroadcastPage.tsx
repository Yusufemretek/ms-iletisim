import { useState } from 'react';
import { Send, Bell, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { trError } from '@/lib/errors';

export function AdminBroadcastPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; count?: number; error?: string } | null>(null);

  const handleSend = async () => {
    setResult(null);
    if (!title.trim()) { setResult({ ok: false, error: 'Başlık zorunludur' }); return; }
    if (!message.trim()) { setResult({ ok: false, error: 'Mesaj zorunludur' }); return; }
    setSending(true);

    const { data, error } = await supabase.rpc('notify_all_customers', {
      p_title: title.trim(),
      p_message: message.trim(),
      p_type: 'broadcast',
    });

    if (error) {
      setResult({ ok: false, error: trError(error) });
    } else {
      setResult({ ok: true, count: (data as number) ?? 0 });
      setTitle('');
      setMessage('');
    }
    setSending(false);
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Send className="h-6 w-6 text-electric-500" /> Toplu Bildirim
        </h1>
        <p className="mt-1 text-sm text-slate-500">Tüm müşterilere anlık push bildirim gönder</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {/* Info banner */}
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-electric-50 p-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-electric-600" />
            <p className="text-sm text-electric-700">
              Bu bildirim tüm kayıtlı müşterilere gönderilir. Bildirim izni vermiş ve cihazını kaydetmiş müşteriler site açık olmasa bile bildirimi alır.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <Input
              label="Bildirim Başlığı *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Özel İndirim Haftası!"
              maxLength={100}
            />
            <Textarea
              label="Mesaj *"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Örn: Tüm telefonlarda %20 indirim fırsatını kaçırmayın..."
              rows={4}
              maxLength={500}
            />
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Bell className="h-3.5 w-3.5" />
              <span>Bildirim izni vermiş tüm müşterilere anında ulaşır</span>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`mt-4 rounded-xl p-3 ${result.ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
              {result.ok ? (
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {result.count} müşteriye bildirim gönderildi.
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm font-medium text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {result.error}
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="mt-5 flex gap-2">
            <Button
              className="flex-1"
              loading={sending}
              onClick={handleSend}
              disabled={!title.trim() || !message.trim()}
            >
              <Send className="h-4 w-4" /> Bildirim Gönder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
