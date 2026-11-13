import { useState, useEffect } from 'react';
import { Mail, Lock, User as UserIcon, Phone, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import type { ConsentChannel } from '@/lib/types';
import { trError } from '@/lib/errors';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
    else navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2">
            <Logo size={48} rounded="rounded-2xl" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              MS <span className="text-blue-600">İletişim</span>
            </span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Giriş Yap</h1>
          <p className="mt-1 text-sm text-slate-500">Hesabınıza giriş yapın.</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="ornek@email.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Giriş Yap
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button onClick={() => navigate('/reset-password')} className="text-slate-500 hover:text-slate-900">
              Şifremi unuttum
            </button>
            <button onClick={() => navigate('/register')} className="font-medium text-amber-600 hover:text-amber-700">
              Hesabın yok mu? Kayıt Ol
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!kvkkAccepted) {
      setError('KVKK Aydınlatma Metni\'ni okuyup onaylamanız zorunludur.');
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email, password);
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }
    // Update profile with name/phone after sign up
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      const userId = sessionData.session.user.id;
      await supabase.from('profiles').update({
        first_name: firstName,
        last_name: lastName,
        phone,
      }).eq('id', userId);

      // Record KVKK acknowledgement
      const { data: kvkkDoc } = await supabase
        .from('legal_documents')
        .select('id, version')
        .eq('document_type', 'kvkk_notice')
        .eq('is_active', true)
        .maybeSingle();

      if (kvkkDoc) {
        await supabase.from('user_legal_acknowledgements').insert({
          user_id: userId,
          document_id: kvkkDoc.id,
          document_version: kvkkDoc.version,
          source: 'registration',
        });
      }

      // Record marketing consent if granted
      if (marketingConsent) {
        const channels: ConsentChannel[] = ['sms', 'email', 'phone', 'push'];
        for (const channel of channels) {
          await supabase.from('consent_logs').insert({
            user_id: userId,
            consent_type: 'commercial_communication',
            channel,
            status: 'granted',
            document_version: kvkkDoc?.version || null,
            source: 'registration',
          });
        }
      }
    }
    setSuccess(true);
    setLoading(false);
    setTimeout(() => navigate('/'), 1500);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Logo size={40} rounded="rounded-full" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Kayıt Başarılı!</h1>
          <p className="mt-1 text-sm text-slate-500">Ana sayfaya yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2">
            <Logo size={48} rounded="rounded-2xl" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              MS <span className="text-blue-600">İletişim</span>
            </span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Kayıt Ol</h1>
          <p className="mt-1 text-sm text-slate-500">Yeni bir hesap oluşturun.</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Ad</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="Ad"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Soyad</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="Soyad"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefon</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="05XX XXX XX XX"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="ornek@email.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="En az 6 karakter"
                />
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={kvkkAccepted}
                  onChange={(e) => setKvkkAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  <strong>KVKK Aydınlatma Metni'ni okudum ve bilgilendirildim.</strong>{' '}
                  <button
                    type="button"
                    onClick={() => setShowKvkkModal(true)}
                    className="font-medium text-blue-600 hover:text-blue-700 underline"
                  >
                    Aydınlatma Metni
                  </button>
                </span>
              </label>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-500">
                  Kampanya, fırsat, indirim, yeni ürün ve duyurular hakkında ticari elektronik ileti almak istiyorum. (İsteğe bağlı)
                </span>
              </label>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Kayıt Ol
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button onClick={() => navigate('/login')} className="font-medium text-amber-600 hover:text-amber-700">
              Hesabın var mı? Giriş Yap
            </button>
          </div>
        </div>
      </div>

      {showKvkkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowKvkkModal(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">KVKK Aydınlatma Metni</h2>
              <button onClick={() => setShowKvkkModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-slate-600">
              <p>MS İLETİŞİM olarak müşterilerimizin kişisel verilerinin gizliliğine önem vermektedir. İşbu Aydınlatma Metni, 6698 sayılı KVKK kapsamında hazırlanmıştır.</p>
              <p><strong>1. Veri Sorumlusu:</strong> Kişisel verileriniz MS İLETİŞİM tarafından işlenmektedir.</p>
              <p><strong>2. İşlenen Veriler:</strong> Kimlik, iletişim, sipariş, cihaz, ödeme bilgileri işlenebilir. Banka/kredi kartı şifresi, CVV kodu gibi güvenlik bilgileri talep edilmez ve kaydedilmez.</p>
              <p><strong>3. İşleme Amaçları:</strong> Üyelik, sipariş, ödeme, teslimat, teknik servis, takas, canlı destek ve hukuki yükümlülüklerin yerine getirilmesi.</p>
              <p><strong>4. Hukuki Sebepler:</strong> KVKK 5. maddesi kapsamında (kanunda öngörülme, sözleşme ifası, hukuki yükümlülük, meşru menfaat, açık rıza) işlenebilir.</p>
              <p><strong>5. Veri Aktarımı:</strong> Bankalar, kargo, servis, kamu kurumları ile gerekli hallerde paylaşım yapılabilir.</p>
              <p><strong>6. Veri Saklama:</strong> Veriler mevzuat süreleri boyunca saklanır, süre sonunda silinir/anonimleştirilir.</p>
              <p><strong>7. Haklarınız:</strong> KVKK 11. madde kapsamında verileriniz hakkında bilgi alma, düzeltme, silme haklarına sahipsiniz.</p>
              <p className="text-xs text-slate-400">Tam metni görmek için <button onClick={() => { setShowKvkkModal(false); navigate('/kvkk'); }} className="text-blue-600 underline">KVKK sayfasını</button> ziyaret edebilirsiniz.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setLoading(false);
    if (err) {
      setError(trError(err));
    } else {
      setMsg('Sifre sifirlama baglantisi e-posta adresinize gonderildi. MS Iletisim olarak gelen kutunuzu kontrol edin.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2">
            <Logo size={48} rounded="rounded-2xl" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              MS <span className="text-blue-600">İletişim</span>
            </span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Şifremi Unuttum</h1>
          <p className="mt-1 text-sm text-slate-500">E-posta adresinize şifre sıfırlama bağlantısı gönderilecek.</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {msg && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="ornek@email.com"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Sıfırlama Bağlantısı Gönder
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button onClick={() => navigate('/login')} className="font-medium text-amber-600 hover:text-amber-700">
              Giriş sayfasına dön
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase sends the recovery token via URL hash. The auth listener in
    // AuthContext picks it up and establishes a session. We just need to
    // wait for it to be ready, then call updateUser.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    // Also check if we already have a session from the recovery link
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (password.length < 6) {
      setError('Sifre en az 6 karakter olmalidir.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Sifreler eslesmiyor.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(trError(err));
    } else {
      setMsg('Sifreniz basariyla guncellendi.');
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2">
            <Logo size={48} rounded="rounded-2xl" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              MS <span className="text-blue-600">Iletisim</span>
            </span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Yeni Sifre Belirle</h1>
          <p className="mt-1 text-sm text-slate-500">Yeni sifrenizi belirleyin.</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {msg && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {msg}
            </div>
          )}

          {!ready && !msg && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              Sifre sifirlama baglantisi dogrulaniyor...
            </div>
          )}

          {ready && !msg && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Yeni Sifre</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="En az 6 karakter"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Sifre Tekrar</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="Sifreyi tekrar girin"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Sifreyi Guncelle
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
