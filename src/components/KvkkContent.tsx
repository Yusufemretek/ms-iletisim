import { Shield, Phone, Mail, MapPin, Wrench, AlertTriangle, FileText, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { StoreSettings, KvkkRequestSubject } from '@/lib/types';

const KVKK_TEXT = `MS İLETİŞİM olarak müşterilerimizin ve kullanıcılarımızın kişisel verilerinin gizliliğine ve güvenliğine önem vermekteyiz.

İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, MS İLETİŞİM tarafından sunulan mağazacılık, e-ticaret, teknik servis, ikinci el cihaz, cihaz alım/takas, teslimat ve müşteri destek hizmetleri kapsamında işlenen kişisel veriler hakkında ilgili kişileri bilgilendirmek amacıyla hazırlanmıştır.`;

export function KvkkContent({ settings }: { settings: StoreSettings | null }) {
  const [showForm, setShowForm] = useState(false);

  const companyTitle = settings?.company_title || 'MS İLETİŞİM';
  const companyAddress = settings?.company_address || settings?.address || 'Adres bilgisi için bizimle iletişime geçiniz.';
  const companyEmail = settings?.kvkk_email || settings?.email || 'Adres bilgisi için bizimle iletişime geçiniz.';
  const companyPhone = settings?.phone || 'Telefon bilgisi için bizimle iletişime geçiniz.';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric-50">
            <Shield className="h-6 w-6 text-electric-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</h1>
            <p className="mt-1 text-sm text-slate-500">MS İLETİŞİM</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">{KVKK_TEXT}</p>
      </div>

      {/* 1. Veri Sorumlusu */}
      <Section number="1" title="Veri Sorumlusu">
        <p className="text-sm leading-relaxed text-slate-600">
          KVKK kapsamında kişisel verileriniz veri sorumlusu sıfatıyla <strong className="text-slate-700">{companyTitle}</strong> tarafından işlenmektedir.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoCard icon={MapPin} label="Adres" value={companyAddress} />
          <InfoCard icon={Phone} label="Telefon" value={companyPhone} />
          <InfoCard icon={Mail} label="E-posta" value={companyEmail} />
          <InfoCard icon={Mail} label="KVKK Başvuru E-postası" value={companyEmail} />
        </div>
      </Section>

      {/* 2. İşlenebilecek Kişisel Veriler */}
      <Section number="2" title="İşlenebilecek Kişisel Veriler">
        <p className="mb-4 text-sm leading-relaxed text-slate-600">Hizmete bağlı olarak aşağıdaki bilgiler işlenebilir:</p>
        <div className="space-y-4">
          <DataGroup title="Kimlik Bilgileri" items={["Ad", "Soyad"]} />
          <DataGroup title="İletişim Bilgileri" items={["Telefon", "E-posta", "Teslimat adresi", "Fatura adresi"]} />
          <DataGroup title="Müşteri İşlem Bilgileri" items={["Siparişler", "Satın alınan ürün/hizmetler", "Sipariş geçmişi", "İade", "İptal", "Teknik servis kayıtları", "Garanti işlemleri", "Talep ve şikâyetler", "Canlı destek görüşmeleri"]} />
          <DataGroup title="Cihaz Bilgileri" items={["Marka", "Model", "IMEI", "Seri numarası", "Hafıza", "Renk", "Pil sağlığı", "Kozmetik durum", "Arıza", "Değişen parçalar", "Servis işlem geçmişi", "İşlem kapsamında yüklenen cihaz fotoğrafları"]} />
          <DataGroup title="Finans / Ödeme" items={["Ödeme yöntemi", "Ödeme tutarı", "Taksit bilgisi", "Ödeme işlem referansı", "Fatura bilgileri", "İade bilgileri"]} />
        </div>
      </Section>

      {/* 3. Kart Güvenliği Uyarısı */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-600">Kart Güvenliği Uyarısı</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-amber-700">
              <strong>MS İLETİŞİM tarafından banka/kredi kartı şifresi, CVV kodu, internet bankacılığı şifresi, e-Devlet şifresi ve benzeri kişisel güvenlik bilgileri talep edilmez ve kaydedilmez.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 4. İşleme Amaçları */}
      <Section number="4" title="Verilerin İşlenme Amaçları">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            "Üyelik ve müşteri hesabının oluşturulması", "Ürün ve hizmetlerin sunulması", "Siparişlerin alınması ve yönetilmesi", "Ödeme işlemlerinin yürütülmesi",
            "Faturalandırma ve muhasebe", "Mağazadan teslim", "Kurye/kargo ve teslimat", "Teknik servis",
            "Teknik servis durum bildirimleri", "Garanti", "Satış sonrası destek", "İkinci el cihaz işlemleri",
            "Telefonunu Sat", "Takas", "Canlı destek", "Talep ve şikâyet yönetimi",
            "Bilgi güvenliği", "Dolandırıcılık/kötüye kullanımın önlenmesi", "Hukuki yükümlülüklerin yerine getirilmesi",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" />
              <span className="text-sm text-slate-600">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 5. Hukuki Sebepler */}
      <Section number="5" title="Hukuki Sebepler">
        <p className="mb-3 text-sm leading-relaxed text-slate-600">Kişisel verileriniz, işleme faaliyetine göre KVKK'nın 5. maddesindeki hukuki sebepler kapsamında işlenebilir:</p>
        <div className="space-y-2">
          {[
            "Kanunlarda açıkça öngörülmesi",
            "Sözleşmenin kurulması veya ifası",
            "Hukuki yükümlülüğün yerine getirilmesi",
            "Bir hakkın tesisi, kullanılması veya korunması",
            "Temel hak ve özgürlüklere zarar vermemek kaydıyla meşru menfaat",
            "Gerekli hallerde açık rıza",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" />
              <span className="text-sm text-slate-600">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 6. Veri Toplama Yöntemleri */}
      <Section number="6" title="Veri Toplama Yöntemleri">
        <p className="text-sm leading-relaxed text-slate-600">
          Kişisel verileriniz; web uygulaması, mobil/PWA, üyelik formları, sipariş, teknik servis, telefonunu sat, takas, canlı destek, mağaza, telefon görüşmesi, elektronik iletişim, ödeme ve teslimat kanalları üzerinden toplanabilir.
        </p>
      </Section>

      {/* 7. Veri Aktarımı */}
      <Section number="7" title="Veri Aktarımı">
        <p className="mb-3 text-sm leading-relaxed text-slate-600">İşlemin gerektirdiği ve hukuki şartların bulunduğu ölçüde aşağıdaki taraflarla paylaşım yapılabilecektir:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            "Yetkili kamu kurumları", "Yargı mercileri", "Muhasebe/mali müşavir", "Bankalar",
            "Ödeme kuruluşları", "Kargo", "Kurye", "Yetkili/teknik servis",
            "IT altyapı hizmeti sağlayıcıları", "Hizmetin yürütülmesi için gerekli hizmet sağlayıcılar",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" />
              <span className="text-sm text-slate-600">{item}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Yurt dışı veri aktarımı gereken bir altyapı kullanılması halinde bunun yürürlükteki KVKK hükümlerine uygun gerçekleştirilmesi gerekmektedir.
        </p>
      </Section>

      {/* 8. Veri Saklama */}
      <Section number="8" title="Veri Saklama">
        <p className="text-sm leading-relaxed text-slate-600">
          Kişisel verileriniz ilgili mevzuattaki süreler ve işleme amacı için gerekli süre boyunca saklanır. Süre sona erdiğinde ve başka hukuki sebep bulunmadığında mevzuata uygun olarak silme, yok etme veya anonimleştirme süreçleri uygulanabilir.
        </p>
      </Section>

      {/* 9. Teknik Servis Özel Bölümü */}
      <div className="rounded-2xl border border-electric-300 bg-electric-50 p-5">
        <div className="flex items-start gap-3">
          <Wrench className="h-5 w-5 shrink-0 text-electric-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-electric-600">Teknik Servis İçin Özel Bilgilendirme</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              <strong>Servis işlemleri mümkün olduğunca cihaz içerisindeki müşteriye ait kişisel içeriklere erişilmeden gerçekleştirilir. Servis işleminin niteliği gereği cihaz erişim bilgilerinin zorunlu olması halinde yalnızca işlem için gerekli bilgiler talep edilir ve amacı dışında kullanılmaz.</strong>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Cihazınızı teknik servise teslim etmeden önce mümkünse kişisel verilerinizi yedeklemeniz ve gerekli güvenlik önlemlerini almanız tavsiye edilir.
            </p>
          </div>
        </div>
      </div>

      {/* 10. KVKK Hakları */}
      <Section number="10" title="KVKK Kapsamındaki Haklarınız">
        <p className="mb-3 text-sm leading-relaxed text-slate-600">KVKK'nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:</p>
        <div className="space-y-2">
          {[
            "Verilerinizin işlenip işlenmediğini öğrenme",
            "İşlenmişse bilgi isteme",
            "İşleme amacını öğrenme",
            "Aktarılan üçüncü kişileri öğrenme",
            "Eksik/yanlış verilerin düzeltilmesini isteme",
            "Şartları varsa silme/yok etme isteme",
            "Kanunda öngörülen diğer hakları kullanma",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" />
              <span className="text-sm text-slate-600">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 11. KVKK Başvuru */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-5 w-5 text-electric-600" />
          <h2 className="text-lg font-bold text-slate-800">KVKK Başvurusu</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          <InfoCard icon={FileText} label="Veri Sorumlusu" value={companyTitle} />
          <InfoCard icon={MapPin} label="Adres" value={companyAddress} />
          <InfoCard icon={Mail} label="E-posta" value={companyEmail} />
          <InfoCard icon={Phone} label="Telefon" value={companyPhone} />
        </div>
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Send className="h-4 w-4" />
          KVKK Başvurusu Yap
        </Button>
      </div>

      <KvkkRequestModal open={showForm} onClose={() => setShowForm(false)} defaultEmail="" defaultPhone="" defaultName="" />
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="mb-3 text-base font-bold text-slate-700">
        <span className="mr-2 text-electric-600">{number}.</span>{title}
      </h2>
      {children}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-medium text-slate-400">{label}</span>
      </div>
      <p className="text-sm text-slate-600">{value}</p>
    </div>
  );
}

function DataGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-600">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">{item}</span>
        ))}
      </div>
    </div>
  );
}

export function KvkkRequestModal({ open, onClose, defaultEmail, defaultPhone, defaultName }: { open: boolean; onClose: () => void; defaultEmail: string; defaultPhone: string; defaultName: string }) {
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState<KvkkRequestSubject>('info_request');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setFullName(defaultName);
      setPhone(defaultPhone);
      setEmail(defaultEmail);
      setSubject('info_request');
      setDescription('');
      setSuccess(false);
      setError('');
    }
  }, [open, defaultName, defaultPhone, defaultEmail]);

  const handleSubmit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim()) {
      setError('Ad soyad ve e-posta alanları zorunludur.');
      return;
    }
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || null;
    const { error: err } = await supabase.from('kvkk_requests').insert({
      user_id: userId,
      full_name: fullName,
      phone: phone || null,
      email,
      subject,
      description: description || null,
    });
    setSubmitting(false);
    if (err) {
      setError('Başvuru gönderilemedi. Lütfen tekrar deneyin.');
      return;
    }
    setSuccess(true);
    setTimeout(() => { onClose(); }, 2500);
  };

  if (success) {
    return (
      <Modal open={open} onClose={onClose} title="">
        <div className="py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <Shield className="h-7 w-7 text-emerald-600" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-800">Başvurunuz Alındı</h3>
          <p className="mt-1 text-sm text-slate-500">KVKK başvurunuz en kısa sürede incelenecektir.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="KVKK Başvuru Formu" size="lg">
      <div className="space-y-3">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Ad Soyad *</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-dark w-full px-3 py-2.5 text-sm"
            placeholder="Adınız Soyadınız"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Telefon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-dark w-full px-3 py-2.5 text-sm"
              placeholder="05XX XXX XX XX"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">E-posta *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark w-full px-3 py-2.5 text-sm"
              placeholder="ornek@email.com"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Başvuru Konusu *</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as KvkkRequestSubject)}
            className="input-dark w-full px-3 py-2.5 text-sm"
          >
            <option value="info_request">Verilerim hakkında bilgi almak istiyorum</option>
            <option value="correction">Bilgilerimi düzeltmek istiyorum</option>
            <option value="deletion">Silme/yok etme talebi</option>
            <option value="preference_change">İletişim tercihlerimi değiştirmek istiyorum</option>
            <option value="other">Diğer</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Açıklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="input-dark w-full px-3 py-2.5 text-sm resize-none"
            placeholder="Başvurunuzun detayını açıklayınız..."
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button className="flex-1" loading={submitting} onClick={handleSubmit}>Başvuru Gönder</Button>
        </div>
      </div>
    </Modal>
  );
}
