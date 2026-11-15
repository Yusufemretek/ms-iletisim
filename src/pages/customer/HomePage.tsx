import { useEffect, useState, useRef, useCallback } from 'react';
import { Smartphone, Recycle, Headphones, Wrench, RefreshCw, TrendingUp, ChevronRight, Zap, MapPin, Phone, Clock, MessageCircle, Package, Tablet, Watch, Megaphone, Tag, ChevronLeft, X, Flame, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/lib/format';
import { getActiveCampaigns, type Campaign } from '@/lib/campaigns';
import { navigate, getNavSeq, openLink } from '@/lib/router';
import { setSeoMeta, injectLocalBusinessJsonLd } from '@/lib/seo';
import type { ProductWithImages } from '@/lib/types';
import { Logo } from '@/components/Logo';

interface PromoBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  button_text: string | null;
  bg_color: string | null;
  sort_order: number;
}

export function HomePage() {
  useCart();
  useAuth();
  const [newPhones, setNewPhones] = useState<ProductWithImages[]>([]);
  const [usedPhones, setUsedPhones] = useState<ProductWithImages[]>([]);
  const [accessories, setAccessories] = useState<ProductWithImages[]>([]);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSeoMeta({
      title: 'MS İletişim | Telefon, Aksesuar ve Teknik Servis',
      description: "MS İletişim'de sıfır ve ikinci el telefonlar, telefon aksesuarları, teknik servis, takas ve telefon alım hizmetlerini keşfedin.",
      path: '/',
    });
    injectLocalBusinessJsonLd();
  }, []);

  useEffect(() => {
    const mySeq = getNavSeq();
    (async () => {
      const [newPhoneRes, accessoryRes, usedData, bannersRes] = await Promise.all([
        supabase.from('products').select('*, product_images(*)').eq('is_active', true).eq('type', 'new_phone').order('created_at', { ascending: false }).limit(8),
        supabase.from('products').select('*, product_images(*)').eq('is_active', true).eq('type', 'accessory').order('created_at', { ascending: false }).limit(4),
        supabase.from('products').select('*, product_images(*)').eq('is_active', true).eq('type', 'used_phone').order('created_at', { ascending: false }).limit(4),
        supabase.from('promo_banners').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);
      if (getNavSeq() !== mySeq) return;
      setNewPhones((newPhoneRes.data as ProductWithImages[]) || []);
      setAccessories((accessoryRes.data as ProductWithImages[]) || []);
      setUsedPhones((usedData.data as ProductWithImages[]) || []);
      setBanners((bannersRes.data as PromoBanner[]) || []);
      setLoading(false);
    })();
  }, []);

  const categories = [
    { icon: Smartphone, label: 'Sıfır Telefon', path: '/telefonlar', color: 'from-electric-500/15 to-electric-700/5', iconColor: 'text-electric-600', borderColor: 'hover:border-electric-500/40' },
    { icon: Recycle, label: '2. El Telefon', path: '/ikinci-el-telefonlar', color: 'from-emerald-500/15 to-emerald-700/5', iconColor: 'text-emerald-600', borderColor: 'hover:border-emerald-500/40' },
    { icon: Headphones, label: 'Aksesuar', path: '/aksesuarlar', color: 'from-amber-500/15 to-amber-700/5', iconColor: 'text-amber-500', borderColor: 'hover:border-amber-500/40' },
    { icon: Tablet, label: 'Tablet', path: '/tabletler', color: 'from-blue-500/15 to-blue-700/5', iconColor: 'text-blue-600', borderColor: 'hover:border-blue-500/40' },
    { icon: Watch, label: 'Akıllı Saat', path: '/akilli-saatler', color: 'from-rose-500/15 to-rose-700/5', iconColor: 'text-rose-500', borderColor: 'hover:border-rose-500/40' },
    { icon: Wrench, label: 'Teknik Servis', path: '/teknik-servis', color: 'from-rose-500/15 to-rose-700/5', iconColor: 'text-rose-500', borderColor: 'hover:border-rose-500/40' },
    { icon: TrendingUp, label: 'Telefonunu Sat', path: '/sell-phone', color: 'from-violet-500/15 to-violet-700/5', iconColor: 'text-violet-500', borderColor: 'hover:border-violet-500/40' },
    { icon: RefreshCw, label: 'Takas', path: '/trade-in', color: 'from-cyan-500/15 to-cyan-700/5', iconColor: 'text-cyan-500', borderColor: 'hover:border-cyan-500/40' },
    { icon: Flame, label: 'Fırsat Ürünleri', path: '/urunler?firsat=1', color: 'from-red-500/15 to-orange-700/5', iconColor: 'text-red-500', borderColor: 'hover:border-red-500/40' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-electric-50/60 via-white to-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.06),_transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-4 pt-5 pb-5 sm:pt-10 sm:pb-8">
          <div className="text-center">
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-electric-200 bg-white px-3.5 py-1.5 text-xs font-medium text-electric-600 shadow-sm sm:mb-4 sm:px-4">
              <Zap className="h-3.5 w-3.5" />
              MS İLETİŞİM
            </div>
            <h1 className="text-2xl font-bold leading-tight text-slate-700 sm:text-4xl sm:leading-tight">
              Yeni Nesil
              <br />
              <span className="text-electric-600">Telefon Deneyimi</span>
            </h1>
            <p className="mt-1.5 text-sm font-medium tracking-wide text-slate-500 sm:mt-3 sm:text-base">
              TELEFON | AKSESUAR | TEKNİK SERVİS
            </p>
          </div>
        </div>
      </div>

      {/* Promotional Banner Carousel */}
      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-5 sm:py-8">
        <h2 className="mb-3 text-lg font-bold text-slate-800 sm:mb-5">Kategoriler</h2>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3 lg:grid-cols-9">
          {categories.map((cat, idx) => (
            <button
              key={cat.label}
              onClick={() => navigate(cat.path)}
              className={`group flex h-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-gradient-to-b ${cat.color} p-2.5 text-center transition-all hover:scale-105 active:scale-95 sm:p-4 ${cat.borderColor}`}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <cat.icon className={`h-5 w-5 sm:h-7 sm:w-7 ${cat.iconColor} transition-transform group-hover:scale-110`} />
              <span className="text-[11px] font-medium leading-tight text-slate-600 sm:text-xs">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Sıfır Telefonlar */}
      <section className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Sıfır Telefonlar</h2>
          <button onClick={() => navigate('/telefonlar')} className="flex items-center gap-1 text-sm text-electric-600 hover:text-electric-700 whitespace-nowrap">
            Tümünü Gör <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-white sm:h-64" />)}
          </div>
        ) : newPhones.length === 0 ? (
          <EmptyState icon={Smartphone} title="Henüz ürün bulunmuyor" subtitle="Yakında yeni telefonlar eklenecek." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {newPhones.map(product => (
              <ProductCardDark key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 2. El Telefonlar */}
      {usedPhones.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">2. El Telefonlar</h2>
            <button onClick={() => navigate('/ikinci-el-telefonlar')} className="flex items-center gap-1 text-sm text-electric-600 hover:text-electric-700 whitespace-nowrap">
              Tümünü Gör <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {usedPhones.map(product => (
              <ProductCardDark key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Aksesuarlar */}
      {accessories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Aksesuarlar</h2>
            <button onClick={() => navigate('/aksesuarlar')} className="flex items-center gap-1 text-sm text-electric-600 hover:text-electric-700 whitespace-nowrap">
              Tümünü Gör <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {accessories.map(product => (
              <ProductCardDark key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Active Discount Campaigns */}
      <DiscountCampaignsSection />

      {/* Footer / Mağaza Bilgisi */}
      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="mx-auto max-w-7xl px-4 py-8 pb-24 lg:pb-10 sm:py-10">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2.5">
                <Logo size={40} className="ring-1 ring-electric-500/20" />
                <div>
                  <span className="block text-lg font-bold leading-tight text-slate-800">
                    MS <span className="text-electric-600">İLETİŞİM</span>
                  </span>
                  <span className="block text-[10px] font-medium leading-tight text-slate-500">
                    TELEFON | AKSESUAR | SERVİS
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">Premium teknoloji mağazası. Sıfır ve 2. el telefon, aksesuar, teknik servis.</p>
            </div>

            {/* Ürünler */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-600">Ürünler</h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button onClick={() => navigate('/telefonlar')} className="hover:text-electric-600">Sıfır Telefonlar</button></li>
                <li><button onClick={() => navigate('/ikinci-el-telefonlar')} className="hover:text-electric-600">2. El Telefonlar</button></li>
                <li><button onClick={() => navigate('/aksesuarlar')} className="hover:text-electric-600">Aksesuarlar</button></li>
                <li><button onClick={() => navigate('/tabletler')} className="hover:text-electric-600">Tabletler</button></li>
                <li><button onClick={() => navigate('/akilli-saatler')} className="hover:text-electric-600">Akıllı Saatler</button></li>
              </ul>
            </div>

            {/* Servis & Destek */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-600">Servis & Destek</h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button onClick={() => navigate('/teknik-servis')} className="hover:text-electric-600">Teknik Servis</button></li>
                <li><button onClick={() => navigate('/sell-phone')} className="hover:text-electric-600">Telefonunu Sat</button></li>
                <li><button onClick={() => navigate('/trade-in')} className="hover:text-electric-600">Takas</button></li>
                <li><button onClick={() => navigate('/support')} className="hover:text-electric-600">Canlı Destek</button></li>
              </ul>
            </div>

            {/* Mağaza */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-600">Mağaza</h3>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-electric-600 mt-0.5" />
                  <span>Niğde / Merkez<br />Yukarı Kayabaşı Mah. Cici Baba Sok. No: 1/B</span>
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-electric-600 mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <a href="tel:+905010311881" className="hover:text-electric-600 transition-colors">0501 031 18 81</a>
                    <a href="tel:+905010020151" className="hover:text-electric-600 transition-colors">0501 002 01 51</a>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-electric-600 mt-0.5" />
                  <span>Pzt - Cmt: 09:00 - 19:00</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} MS İletişim. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}

function BannerCarousel({ banners }: { banners: PromoBanner[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [arrowsVisible, setArrowsVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arrowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showArrows = useCallback(() => {
    setArrowsVisible(true);
    if (arrowTimerRef.current) clearTimeout(arrowTimerRef.current);
    arrowTimerRef.current = setTimeout(() => setArrowsVisible(false), 3500);
  }, []);

  useEffect(() => {
    showArrows();
    return () => { if (arrowTimerRef.current) clearTimeout(arrowTimerRef.current); };
  }, [showArrows]);

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  const goTo = (index: number) => {
    setCurrent((index + banners.length) % banners.length);
    showArrows();
  };

  const banner = banners[current];

  return (
    <section
      className="mx-auto max-w-7xl px-4 pt-6"
      onMouseEnter={() => { setPaused(true); showArrows(); }}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={showArrows}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className={`flex transition-transform duration-500 ease-out`} style={{ transform: `translateX(-${current * 100}%)` }}>
          {banners.map(b => (
            <div key={b.id} className="w-full shrink-0">
              <div
                className={`relative flex min-h-[180px] items-center bg-gradient-to-r ${b.bg_color || 'from-electric-500 to-electric-700'} p-6 sm:min-h-[200px] sm:p-10`}
              >
                {b.image_url && (
                  <img
                    src={b.image_url}
                    alt={b.title}
                    className="absolute inset-0 h-full w-full object-cover opacity-20"
                  />
                )}
                <div className="relative z-10 max-w-lg">
                  <h3 className="text-xl font-bold text-white sm:text-2xl">{b.title}</h3>
                  {b.subtitle && <p className="mt-2 text-sm text-white/80 sm:text-base">{b.subtitle}</p>}
                  {b.button_text && (
                    <button
                      onClick={() => openLink(b.link_url)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:bg-white hover:scale-105"
                    >
                      {b.button_text}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation arrows with auto-hide */}
        {banners.length > 1 && (
          <>
            <button
              onClick={() => goTo(current - 1)}
              className={`absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur-sm transition-all duration-500 hover:bg-white/50 ${arrowsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => goTo(current + 1)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur-sm transition-all duration-500 hover:bg-white/50 ${arrowsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function DiscountCampaignsSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await getActiveCampaigns();
      setCampaigns(data);
      setLoading(false);
    })();
  }, []);

  if (loading || campaigns.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex items-center gap-2 sm:mb-5">
        <Megaphone className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-bold text-slate-800">Güncel İndirimler</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map(c => (
          <div
            key={c.id}
            className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 transition-all hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <Tag className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">{c.name}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {c.discount_type === 'percentage'
                    ? `%${c.discount_value} indirim`
                    : `${formatPrice(c.discount_value)} indirim`}
                </p>
              </div>
              <span className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
                {c.discount_type === 'percentage'
                  ? `%${c.discount_value}`
                  : `${formatPrice(c.discount_value)}`}
              </span>
            </div>
            <button
              onClick={() => navigate('/urunler')}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-100 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200"
            >
              Ürünleri Gör <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof Package; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-600">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function ProductCardDark({ product }: { product: ProductWithImages }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    (async () => {
      const campaigns = await getActiveCampaigns();
      const found = campaigns.find(c =>
        c.scope_type === 'all' ||
        (c.scope_type === 'products' && c.product_ids?.includes(product.id)) ||
        (c.scope_type === 'categories' && product.category_id && c.category_ids?.includes(product.category_id))
      ) || null;
      setCampaign(found);
    })();
  }, [product.id, product.category_id]);

  const finalPrice = campaign
    ? campaign.discount_type === 'percentage'
      ? Math.max(0, Math.round(product.sale_price * (1 - campaign.discount_value / 100)))
      : Math.max(0, product.sale_price - campaign.discount_value)
    : product.sale_price;
  const hasDiscount = campaign && finalPrice < product.sale_price;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      model: product.model,
      unit_price: product.sale_price,
      quantity: 1,
      stock: product.stock,
      image_url: primaryImage?.image_url || null,
      type: product.type,
      imei: product.imei || null,
    });
  };

  return (
    <button
      onClick={() => navigate(product.slug ? `/urun/${product.slug}` : `/product/${product.id}`)}
      className="premium-card group flex h-full flex-col overflow-hidden text-left active:scale-95"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {primaryImage ? (
          <img src={primaryImage.image_url} alt={product.name} className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Smartphone className="h-10 w-10 text-slate-300 sm:h-12 sm:w-12" />
          </div>
        )}
        {product.stock <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm sm:text-sm">STOKTA YOK</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        {product.brand && <p className="text-xs text-slate-500">{product.brand}</p>}
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">{product.name}</h3>
        {product.model && <p className="truncate text-xs text-slate-400">{product.model}</p>}
        <div className="mt-auto pt-2">
          {hasDiscount && (
            <div className="mb-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                <Tag className="h-2.5 w-2.5" />{campaign!.discount_type === 'percentage' ? `%${campaign!.discount_value}` : `${formatPrice(campaign!.discount_value)}`}
              </span>
              <span className="text-xs text-slate-400 line-through">{formatPrice(product.sale_price)}</span>
            </div>
          )}
          <div className="flex items-end justify-between">
            <span className="text-base font-bold text-electric-600 sm:text-lg">{formatPrice(finalPrice)}</span>
            {product.stock > 0 && <span className="text-xs text-emerald-600">Stokta</span>}
          </div>
          {product.stock > 0 && (
            <button
              onClick={handleAdd}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-electric-50 py-2 text-xs font-medium text-electric-600 transition-colors hover:bg-electric-100 active:scale-95"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Sepete Ekle
            </button>
          )}
        </div>
      </div>
    </button>
  );
}
