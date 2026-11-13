import { useEffect, useState } from 'react';
import { Shield, Mail, MessageSquare, Phone, Bell, FileText, Send, ArrowLeft, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { navigate } from '@/lib/router';
import { Button } from '@/components/ui/Button';
import { KvkkRequestModal } from '@/components/KvkkContent';
import type { ConsentLog, ConsentChannel } from '@/lib/types';

const CHANNELS: { key: ConsentChannel; label: string; icon: typeof Mail }[] = [
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'email', label: 'E-posta', icon: Mail },
  { key: 'phone', label: 'Telefon', icon: Phone },
  { key: 'push', label: 'Push Bildirim', icon: Bell },
];

export function PrivacyPage() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<ConsentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('consent_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('store_settings').select('*').limit(1).maybeSingle(),
    ]).then(([logsRes]) => {
      setLogs((logsRes.data as ConsentLog[]) || []);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const getCurrentStatus = (channel: ConsentChannel): 'granted' | 'revoked' | null => {
    const channelLogs = logs.filter(l => l.consent_type === 'commercial_communication' && l.channel === channel);
    if (channelLogs.length === 0) return null;
    return channelLogs[0].status;
  };

  const toggleConsent = async (channel: ConsentChannel) => {
    const current = getCurrentStatus(channel);
    const newStatus = current === 'granted' ? 'revoked' : 'granted';
    setUpdating(channel);
    const { data: ackData } = await supabase
      .from('legal_documents')
      .select('version')
      .eq('document_type', 'commercial_communication')
      .eq('is_active', true)
      .maybeSingle();
    const { error } = await supabase.from('consent_logs').insert({
      user_id: user.id,
      consent_type: 'commercial_communication',
      channel,
      status: newStatus,
      document_version: ackData?.version || null,
      source: 'account_settings',
    });
    setUpdating(null);
    if (error) return;
    const { data: newLogs } = await supabase.from('consent_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setLogs((newLogs as ConsentLog[]) || []);
  };

  const defaultName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <button onClick={() => navigate('/profile')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">Gizlilik ve İzinler</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
          </div>
        ) : (
          <>
            {/* KVKK Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-5 w-5 text-electric-600" />
                <h2 className="text-base font-bold text-slate-800">KVKK</h2>
              </div>
              <p className="mb-4 text-sm text-slate-500">Kişisel verilerinizin nasıl işlendiği hakkında bilgi almak için Aydınlatma Metnini inceleyebilirsiniz.</p>
              <Button variant="outline" onClick={() => navigate('/kvkk')}>
                <FileText className="h-4 w-4" />
                Aydınlatma Metnini Görüntüle
              </Button>
            </div>

            {/* Communication Preferences */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="h-5 w-5 text-electric-600" />
                <h2 className="text-base font-bold text-slate-800">İletişim Tercihleri</h2>
              </div>
              <p className="mb-4 text-sm text-slate-500">Kampanya, fırsat ve duyurular hakkında hangi kanallardan ileti almak istediğinizi seçin.</p>
              <div className="space-y-2">
                {CHANNELS.map(({ key, label, icon: Icon }) => {
                  const status = getCurrentStatus(key);
                  const granted = status === 'granted';
                  return (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-600">{label}</p>
                          <p className="text-xs text-slate-400">
                            {status === null ? 'Henüz tercih belirtilmedi' : granted ? 'İzin verildi' : 'İzin geri çekildi'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleConsent(key)}
                        disabled={updating === key}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${granted ? 'bg-electric-500' : 'bg-slate-200'} disabled:opacity-50`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${granted ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KVKK Requests */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5 text-electric-600" />
                <h2 className="text-base font-bold text-slate-800">Hesap / Veri Talepleri</h2>
              </div>
              <p className="mb-4 text-sm text-slate-500">KVKK kapsamında kişisel verilerinizle ilgili başvuru yapabilirsiniz.</p>
              <Button onClick={() => setShowForm(true)}>
                <Send className="h-4 w-4" />
                KVKK Başvurusu Yap
              </Button>
            </div>

            {/* Consent History */}
            {logs.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-base font-bold text-slate-800">İzin Geçmişi</h2>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      {log.status === 'granted' ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm text-slate-600">
                          {log.consent_type === 'commercial_communication' ? 'Ticari İletişim' : log.consent_type}
                          {log.channel ? ` - ${log.channel.toUpperCase()}` : ''}
                          {' · '}
                          {log.status === 'granted' ? 'İzin Verildi' : 'İzin Geri Çekildi'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(log.created_at).toLocaleString('tr-TR')}
                          {log.source ? ` · ${log.source}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <KvkkRequestModal
        open={showForm}
        onClose={() => setShowForm(false)}
        defaultEmail={user.email || ''}
        defaultPhone={profile?.phone || ''}
        defaultName={defaultName}
      />
    </div>
  );
}
