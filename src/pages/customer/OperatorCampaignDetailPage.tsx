import { useEffect, useState, useCallback } from 'react';
import { Signal, Wifi, Phone, MessageSquare, Calendar, Clock, CheckCircle2, ArrowLeft, Info, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import type { OperatorCampaign, Operator } from '@/lib/types';
import { formatInternet, formatMinutes, formatSms, formatCommitment, formatPriceOrRequest, ELIGIBILITY_LABELS, isCampaignExpired } from '@/lib/operator-campaigns';
import { KvkkLink } from '@/components/KvkkLink';

export function OperatorCampaignDetailPage({ slug }: { slug: string }) {
  const { user, profile } = useAuth();
  const [campaign, setCampaign] = useState<OperatorCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    current_operator: '',
    request_type: 'campaign_info',
    customer_note: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('operator_campaigns')
      .select('*, operator:operators(*), category:operator_campaign_categories(*)')
      .eq('slug', slug)
      .eq('archived', false)
      .maybeSingle();
    setCampaign(data as OperatorCampaign | null);
    setLoading(false);
    if (data && isCampaignExpired(data as OperatorCampaign)) {
      setCampaign(null);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        full_name: profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : f.full_name,
        phone: profile?.phone || f.phone,
      }));
    }
  }, [user, profile]);

  // Auto-open form if query has action=info
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'info' && campaign) {
      setShowForm(true);
    }
  }, [campaign]);

  const handleSubmit = async () => {
    setError('');
    if (!form.full_name.trim()) { setError('Ad Soyad zorunludur'); return; }
    if (!form.phone.trim()) { setError('Telefon numarası zorunludur'); return; }
    if (!campaign) return;

    setSubmitting(true);

    // Dedup: check if user already submitted for this campaign within 24h
    if (user) {
      const { data: existing } = await supabase
        .from('operator_leads')
        .select('id, created_at')
        .eq('campaign_id', campaign.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const created = new Date((existing as { created_at: string }).created_at);
        const hoursSince = (Date.now() - created.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          setError('Bu kampanya için son 24 saat içinde zaten talepte bulundunuz. Ekibimiz sizinle iletişime geçecektir.');
          setSubmitting(false);
          return;
        }
      }
    }

    const { error: err } = await supabase.from('operator_leads').insert({
      campaign_id: campaign.id,
      operator_id: campaign.operator_id,
      user_id: user?.id || null,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      current_operator: form.current_operator || null,
      request_type: form.request_type,
      customer_note: form.customer_note || null,
      status: 'new',
    });

    setSubmitting(false);

    if (err) {
      setError('Talep gönderilemedi. Lütfen tekrar deneyin.');
      return;
    }

    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-slate-800">Kampanya bulunamadı</h1>
          <p className="mt-1 text-sm text-slate-500">Bu kampanya artık mevcut olmayabilir veya süresi dolmuş olabilir.</p>
          <button onClick={() => navigate('/operator-kampanyalari')} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-electric-600 hover:text-electric-600">
            <ArrowLeft className="h-4 w-4" /> Kampanyalara Dön
          </button>
        </div>
      </div>
    );
  }

  const op = campaign.operator;
  const cat = campaign.category;

  return (
    <div className="min-h-screen bg-slate-100 pb-24 lg:pb-10">
      {/* Back bar */}
      <div className="border-b border-slate-200 bg-white/50">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <button onClick={() => navigate('/operator-kampanyalari')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-electric-600">
            <ArrowLeft className="h-4 w-4" /> Operatör Kampanyaları
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(22,139,255,0.08),_transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-4 pt-8 pb-6">
          <div className="flex items-center gap-3">
            {op?.logo_url ? (
              <img src={op.logo_url} alt={op.name} className="h-12 w-12 rounded-xl object-contain" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: op?.color || '#6366f1' }}>
                {op?.name?.[0] || '?'}
              </span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">{op?.name}</span>
                {cat && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{cat.name}</span>}
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-slate-800 sm:text-2xl">{campaign.name}</h1>
            </div>
          </div>
          {campaign.short_description && (
            <p className="mt-3 text-sm text-slate-500">{campaign.short_description}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Campaign image */}
        {campaign.image_url && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200">
            <img src={campaign.image_url} alt={campaign.name} className="h-48 w-full object-cover sm:h-64" />
          </div>
        )}

        {/* Key specs grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SpecCard icon={Wifi} label="İnternet" value={formatInternet(campaign)} />
          <SpecCard icon={Phone} label="Dakika" value={formatMinutes(campaign)} />
          <SpecCard icon={MessageSquare} label="SMS" value={formatSms(campaign)} />
          <SpecCard icon={Calendar} label="Taahhüt" value={formatCommitment(campaign.commitment_months)} />
        </div>

        {/* Price */}
        <div className="mb-6 rounded-2xl border border-electric-300 bg-electric-50 p-5">
          <p className="text-xs font-medium text-slate-500">Aylık Ücret</p>
          <p className="mt-1 text-2xl font-bold text-electric-600">{formatPriceOrRequest(campaign)}</p>
        </div>

        {/* Description */}
        {campaign.description && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-slate-600">Açıklama</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-500">{campaign.description}</p>
          </div>
        )}

        {/* Eligibility */}
        {campaign.eligibility.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-slate-600">Kimler Yararlanabilir?</h2>
            <div className="flex flex-wrap gap-2">
              {campaign.eligibility.map(e => (
                <span key={e} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {ELIGIBILITY_LABELS[e] || e}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Additional details */}
        <div className="mb-6 space-y-2">
          {campaign.age_requirement != null && (
            <DetailRow label="Yaş Şartı" value={`${campaign.age_requirement} yaş ve üzeri`} />
          )}
          {campaign.start_date && (
            <DetailRow icon={Calendar} label="Başlangıç Tarihi" value={new Date(campaign.start_date).toLocaleDateString('tr-TR')} />
          )}
          {campaign.end_date && (
            <DetailRow icon={Clock} label="Bitiş Tarihi" value={new Date(campaign.end_date).toLocaleDateString('tr-TR')} />
          )}
        </div>

        {/* Terms */}
        {campaign.terms && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-slate-600">Kampanya Koşulları</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-500">{campaign.terms}</p>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs text-amber-600">Kampanya fiyatları ve koşulları operatör tarafından değiştirilebilir. Güncel uygunluk ve başvuru koşulları işlem öncesinde teyit edilir.</p>
        </div>

        {/* CTA */}
        {!submitted && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {!showForm ? (
              <div className="text-center">
                <p className="mb-3 text-sm text-slate-500">Bu kampanya hakkında detaylı bilgi almak için bizimle iletişime geçin.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-electric-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-electric-600"
                >
                  <Signal className="h-4 w-4" /> Bilgi Al
                </button>
              </div>
            ) : (
              <div>
                <h3 className="mb-4 text-base font-bold text-slate-700">Bilgi Talebi</h3>
                {error && (
                  <div className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-500">{error}</div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Ad Soyad *</label>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={e => setForm({ ...form, full_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-electric-500/50 focus:outline-none"
                      placeholder="Adınız Soyadınız"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Telefon Numarası *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-electric-500/50 focus:outline-none"
                      placeholder="05XX XXX XX XX"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Mevcut Operatör</label>
                    <select
                      value={form.current_operator}
                      onChange={e => setForm({ ...form, current_operator: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-electric-500/50 focus:outline-none"
                    >
                      <option value="">Seçiniz</option>
                      <option value="Vodafone">Vodafone</option>
                      <option value="Turkcell">Turkcell</option>
                      <option value="Türk Telekom">Türk Telekom</option>
                      <option value="Diğer">Diğer</option>
                      <option value="Hattım Yok">Hattım Yok</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">İşlem Türü *</label>
                    <select
                      value={form.request_type}
                      onChange={e => setForm({ ...form, request_type: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-electric-500/50 focus:outline-none"
                    >
                      <option value="number_portability">Numara Taşıma</option>
                      <option value="new_line">Yeni Hat</option>
                      <option value="tariff_change">Tarife Değişikliği</option>
                      <option value="campaign_info">Kampanya Hakkında Bilgi</option>
                      <option value="other">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Not (opsiyonel)</label>
                    <textarea
                      value={form.customer_note}
                      onChange={e => setForm({ ...form, customer_note: e.target.value })}
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-electric-500/50 focus:outline-none"
                      placeholder="Eklemek istediğiniz not"
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-1">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
                    <KvkkLink className="text-xs" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-electric-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-electric-600 disabled:opacity-50"
                    >
                      {submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {submitted && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h2 className="mt-4 text-xl font-bold text-slate-800">Talebiniz Alındı</h2>
            <p className="mt-2 text-sm text-slate-500">MS İletişim ekibi kampanya hakkında sizinle iletişime geçecektir.</p>
            <button
              onClick={() => navigate('/operator-kampanyalari')}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-electric-50 px-5 py-2.5 text-sm font-medium text-electric-600 hover:bg-electric-100"
            >
              <ArrowLeft className="h-4 w-4" /> Kampanyalara Dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SpecCard({ icon: Icon, label, value }: { icon: typeof Wifi; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Icon className="h-5 w-5 text-slate-400" />
      <p className="mt-2 text-xs text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-700">{value}</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon?: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-slate-500">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        {label}
      </span>
      <span className="text-sm font-medium text-slate-600">{value}</span>
    </div>
  );
}
