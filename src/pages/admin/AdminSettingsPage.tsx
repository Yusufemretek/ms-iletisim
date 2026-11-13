import { useEffect, useState } from 'react';
import { Settings, Shield, UserPlus, Trash2, AlertCircle, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';
import { trError } from '@/lib/errors';

interface AdminRow {
  user_id: string;
  created_at: string;
  email?: string;
}

export function AdminSettingsPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => { loadAdmins(); loadSettings(); }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from('store_settings').select('min_order_amount').maybeSingle();
    if (data) setMinOrderAmount(String(data.min_order_amount ?? 0));
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error: saveErr } = await supabase.from('store_settings').update({ min_order_amount: Number(minOrderAmount) || 0 }).eq('id', 1);
    setSavingSettings(false);
    if (saveErr) { setError('Ayarlar kaydedilemedi: ' + trError(saveErr)); return; }
    setMsg('Teslimat ayarları kaydedildi.');
    setTimeout(() => setMsg(''), 3000);
  };

  const loadAdmins = async () => {
    setLoading(true);
    const { data } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
    // We can't join auth.users, so just show IDs
    setAdmins((data as AdminRow[]) || []);
    setLoading(false);
  };

  const handleAddAdmin = async () => {
    setError('');
    setMsg('');
    if (!newAdminEmail.trim()) return;
    // Find user by email in profiles
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', newAdminEmail).maybeSingle();
    if (!profile) {
      setError('Bu e-posta ile kayıtlı kullanıcı bulunamadı.');
      return;
    }
    const { error: rpcError } = await supabase.rpc('add_admin', { target: profile.id });
    if (rpcError) {
      setError(trError(rpcError));
      return;
    }
    setMsg('Admin eklendi.');
    setNewAdminEmail('');
    loadAdmins();
    setTimeout(() => setMsg(''), 3000);
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (userId === user?.id) {
      setError('Kendinizi adminlikten çıkaramazsınız.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (!confirm('Bu kullanıcıyı adminlikten çıkarmak istediğinize emin misiniz?')) return;
    await supabase.from('admins').delete().eq('user_id', userId);
    loadAdmins();
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Ayarlar</h1>
        <p className="mt-1 text-sm text-slate-500">Admin yönetimi ve sistem ayarları</p>
      </div>

      {/* Delivery settings */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Truck className="h-5 w-5 text-slate-400" /> Teslimat Ayarları
        </h2>
        {msg && (
          <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
        )}
        <div className="max-w-xs">
          <Input
            label="Minimum Sepet Tutarı (Kurye Teslimatı) (₺)"
            type="number"
            min={0}
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            placeholder="0"
          />
          <p className="mt-1 text-xs text-slate-400">0 yazarsanız minimum tutar uygulanmaz. Kurye teslimatı istendiğinde sepet tutarı bu değerden düşükse sipariş verilmez.</p>
        </div>
        <Button className="mt-3" loading={savingSettings} onClick={saveSettings}>Kaydet</Button>
      </div>

      {/* Admin management */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Shield className="h-5 w-5 text-slate-400" /> Admin Yönetimi
        </h2>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {msg && (
          <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
        )}

        {/* Add admin */}
        <div className="mb-4 flex gap-2">
          <Input
            placeholder="Kullanıcı e-posta adresi"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAddAdmin}>
            <UserPlus className="h-4 w-4" /> Admin Ekle
          </Button>
        </div>

        {/* Admin list */}
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.user_id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {admin.user_id === user?.id ? 'Siz' : 'Admin'}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(admin.created_at)} tarihinde eklendi</p>
                  </div>
                  {admin.user_id === user?.id && <Badge variant="success">Siz</Badge>}
                </div>
                <button
                  onClick={() => handleRemoveAdmin(admin.user_id)}
                  disabled={admin.user_id === user?.id}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex gap-3">
          <Settings className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-bold text-blue-900">Bilgi</p>
            <p className="mt-1 text-sm text-blue-700">
              Admin yetkisi vermek için kullanıcının önce uygulamaya kayıt olmuş olması gerekir.
              Kayıt olduktan sonra e-posta adresini yukarıdaki alana girerek admin yapabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
