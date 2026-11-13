import { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart, ImageOff, Check, Minus, Plus, Shield, Battery, Cpu, Camera, Smartphone, Monitor, MemoryStick, Zap, Tag, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/format';
import { setSeoMeta, injectProductJsonLd, removeProductJsonLd, injectBreadcrumbJsonLd, removeBreadcrumbJsonLd } from '@/lib/seo';
import type { ProductWithImages, ProductVariant } from '@/lib/types';
import { navigate } from '@/lib/router';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getActiveCampaigns, getCampaignForProduct, applyDiscount, type Campaign } from '@/lib/campaigns';

interface ProductDetailPageProps {
  id?: string;
  slug?: string;
}

export function ProductDetailPage({ id, slug }: ProductDetailPageProps) {
  const [product, setProduct] = useState<ProductWithImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const { addItem } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      let query = supabase
        .from('products')
        .select('*, category:categories(*), product_images(*), product_variants(*)');

      if (slug) {
        query = query.eq('slug', slug);
      } else if (id) {
        query = query.eq('id', id);
      } else {
        setLoading(false);
        return;
      }

      const { data } = await query.maybeSingle();
      const product = data as ProductWithImages | null;
      setProduct(product);

      // Load active variants sorted by sort_order
      if (product) {
        const activeVariants = (product.product_variants || [])
          .filter((v: ProductVariant) => v.is_active)
          .sort((a: ProductVariant, b: ProductVariant) => a.sort_order - b.sort_order);
        setVariants(activeVariants);
        // Auto-select first in-stock variant, or first variant
        if (activeVariants.length > 0) {
          const firstInStock = activeVariants.find((v: ProductVariant) => v.stock > 0);
          setSelectedVariantId((firstInStock || activeVariants[0]).id);
        }
      }

      if (product) {
        const campaigns = await getActiveCampaigns();
        setCampaign(getCampaignForProduct(product.id, product.category_id || null, campaigns));
      }

      setLoading(false);

      if (product) {
        const productUrl = product.slug
          ? `https://msiletisim.com/urun/${product.slug}`
          : `https://msiletisim.com/product/${product.id}`;
        const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
        const title = `${product.name}${product.brand ? ' — ' + product.brand : ''} | MS İletişim`;
        const description = product.description || `${product.name} — ${product.brand || ''} ${product.model || ''} — MS İletişim'de güvenle satın alın.`;

        setSeoMeta({
          title,
          description,
          path: product.slug ? `/urun/${product.slug}` : `/product/${product.id}`,
          image: primaryImage?.image_url,
          type: 'product',
        });

        injectProductJsonLd({
          name: product.name,
          description,
          price: product.sale_price,
          currency: 'TRY',
          availability: product.stock > 0 && product.is_active ? 'InStock' : 'OutOfStock',
          url: productUrl,
          image: primaryImage?.image_url,
          brand: product.brand || undefined,
          category: product.category?.name,
        });

        const categoryPath = product.type === 'used_phone' ? '/ikinci-el-telefonlar'
          : product.type === 'accessory' ? '/aksesuarlar'
          : product.type === 'tablet' ? '/tabletler'
          : product.type === 'smartwatch' ? '/akilli-saatler'
          : '/telefonlar';
        const categoryName = product.type === 'used_phone' ? '2. El Telefonlar'
          : product.type === 'accessory' ? 'Aksesuarlar'
          : product.type === 'tablet' ? 'Tabletler'
          : product.type === 'smartwatch' ? 'Akıllı Saatler'
          : 'Sıfır Telefonlar';
        injectBreadcrumbJsonLd([
          { name: 'MS İletişim', url: 'https://msiletisim.com/' },
          { name: categoryName, url: `https://msiletisim.com${categoryPath}` },
          { name: product.name, url: productUrl },
        ]);
      } else {
        removeProductJsonLd();
        removeBreadcrumbJsonLd();
      }
    })();
    return () => { removeProductJsonLd(); removeBreadcrumbJsonLd(); };
  }, [id, slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-slate-200" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-24 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <p className="text-slate-500">Ürün bulunamadı.</p>
        <Button className="mt-4" onClick={() => navigate('/urunler')}>
          Ürünlere Dön
        </Button>
      </div>
    );
  }

  const images = product.product_images || [];
  const currentImage = images[activeImage];
  const hasVariants = variants.length > 0;
  const selectedVariant = hasVariants ? variants.find((v) => v.id === selectedVariantId) || null : null;
  const effectivePrice = selectedVariant ? selectedVariant.price : product.sale_price;
  const effectiveStock = selectedVariant ? selectedVariant.stock : product.stock;
  const inStock = effectiveStock > 0 && product.is_active;

  const finalPrice = campaign ? applyDiscount(effectivePrice, campaign) : effectivePrice;
  const hasDiscount = campaign && finalPrice < effectivePrice;

  const handleAdd = () => {
    if (!inStock) return;
    if (!user) {
      navigate('/login');
      return;
    }
    addItem({
      product_id: product.id,
      variant_id: selectedVariant ? selectedVariant.id : null,
      variant_storage: selectedVariant ? selectedVariant.storage : null,
      name: product.name,
      brand: product.brand,
      model: product.model,
      unit_price: finalPrice,
      quantity: qty,
      stock: effectiveStock,
      image_url: currentImage?.image_url || images[0]?.image_url || null,
      type: product.type,
      imei: product.imei || null,
      pickup_only: product.pickup_only ?? false,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const newPhoneSpecs: { label: string; value: string | null; icon: typeof Battery }[] = [
    { label: 'Hafıza', value: product.memory, icon: MemoryStick },
    { label: 'RAM', value: product.ram, icon: Cpu },
    { label: 'Renk', value: product.color, icon: Smartphone },
    { label: 'Ekran', value: product.screen_size, icon: Monitor },
    { label: 'Kamera', value: product.camera_info, icon: Camera },
    { label: 'Batarya', value: product.battery_capacity, icon: Battery },
    { label: 'İşlemci', value: product.processor, icon: Cpu },
    { label: 'İşletim Sistemi', value: product.operating_system, icon: Zap },
    { label: 'Garanti', value: '2 Yıl Türkiye Garantili', icon: Shield },
  ];
  const usedPhoneSpecs: { label: string; value: string | null; icon: typeof Battery }[] = [
    { label: 'Hafıza', value: product.memory, icon: Cpu },
    { label: 'RAM', value: product.ram, icon: Cpu },
    { label: 'Renk', value: product.color, icon: Shield },
    { label: 'Pil Sağlığı', value: product.battery_health ? `%${product.battery_health}` : null, icon: Battery },
    { label: 'Kozmetik Durum', value: product.cosmetic_condition, icon: Shield },
    { label: 'Ekran Durumu', value: product.screen_condition, icon: Shield },
    { label: 'Face ID', value: product.face_id, icon: Shield },
    { label: 'Touch ID', value: product.touch_id, icon: Shield },
    { label: 'True Tone', value: product.true_tone, icon: Shield },
    { label: 'Kamera Durumu', value: product.camera_condition, icon: Camera },
    { label: 'Hoparlör', value: product.speaker_condition, icon: Shield },
    { label: 'Mikrofon', value: product.microphone_condition, icon: Shield },
    { label: 'Garanti Durumu', value: product.warranty_status, icon: Shield },
    { label: 'Garanti Bitiş', value: product.warranty_end_date ? new Date(product.warranty_end_date).toLocaleDateString('tr-TR') : null, icon: Shield },
    { label: 'Kutu Durumu', value: product.box_condition, icon: Shield },
    { label: 'Şarj Aleti', value: product.charger_condition, icon: Battery },
  ];
  const isNewPhone = product.type === 'new_phone' || product.type === 'tablet' || product.type === 'smartwatch';
  const activePhoneSpecs = (isNewPhone ? newPhoneSpecs : usedPhoneSpecs).filter((s) => s.value);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <button
        onClick={() => navigate('/urunler')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Ürünlere Dön
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Images */}
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {currentImage ? (
              <img
                src={currentImage.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <ImageOff className="h-16 w-16" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(idx)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    idx === activeImage ? 'border-slate-900' : 'border-slate-200'
                  }`}
                >
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            {product.type === 'used_phone' && <Badge variant="info">2. El Telefon</Badge>}
            {product.type === 'new_phone' && <Badge variant="success">Sıfır Telefon</Badge>}
            {product.type === 'accessory' && <Badge variant="default">Aksesuar</Badge>}
            {product.type === 'tablet' && <Badge variant="warning">Tablet</Badge>}
            {product.type === 'smartwatch' && <Badge variant="warning">Akıllı Saat</Badge>}
            {product.category && <Badge>{product.category.name}</Badge>}
            {inStock ? (
              <Badge variant="success">Stokta {effectiveStock} adet</Badge>
            ) : (
              <Badge variant="error">Stokta Yok</Badge>
            )}
          </div>

          {product.brand && (
            <p className="mt-3 text-sm font-medium text-slate-400">{product.brand}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{product.name}</h1>
          {product.model && (
            <p className="mt-1 text-base text-slate-500">{product.model}</p>
          )}

          {/* Memory variant selector */}
          {hasVariants && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Hafıza:</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const isOos = v.stock <= 0;
                  const isSelected = v.id === selectedVariantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={isOos}
                      onClick={() => { setSelectedVariantId(v.id); setQty(1); }}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {v.storage}
                      {isOos && <span className="ml-1 text-xs text-slate-400">(Stokta Yok)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            {hasDiscount ? (
              <>
                <Badge variant="error" className="mr-1"><Tag className="mr-0.5 inline h-3 w-3" /> {campaign!.discount_type === 'percentage' ? `%${campaign!.discount_value}` : `${formatPrice(campaign!.discount_value)}`} İndirim</Badge>
                <span className="text-sm text-slate-400 line-through">{formatPrice(effectivePrice)}</span>
                <span className="text-2xl font-bold text-red-600 sm:text-3xl">{formatPrice(finalPrice)}</span>
              </>
            ) : (
              <span className="text-2xl font-bold text-slate-900 sm:text-3xl">
                {formatPrice(effectivePrice)}
              </span>
            )}
          </div>

          {product.description && (
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{product.description}</p>
          )}

          {product.pickup_only && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <Store className="h-4 w-4 shrink-0" />
              <span>Bu ürün sadece <strong>dükkandan teslim</strong> alınabilir. Kurye teslimatı yoktur.</span>
            </div>
          )}

          {/* Quantity + add */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-slate-300">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={!inStock || qty <= 1}
                className="p-2.5 text-slate-600 disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-sm font-semibold">{qty}</span>
              <button
                onClick={() => setQty(Math.min(effectiveStock, qty + 1))}
                disabled={!inStock || qty >= effectiveStock}
                className="p-2.5 text-slate-600 disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              size="lg"
              variant={inStock ? 'primary' : 'outline'}
              disabled={!inStock}
              onClick={handleAdd}
              className="flex-1"
            >
              {added ? (
                <>
                  <Check className="h-5 w-5" />
                  Sepete Eklendi
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  {inStock ? 'Sepete Ekle' : 'Stokta Yok'}
                </>
              )}
            </Button>
          </div>
          {!user && inStock && (
            <p className="mt-2 text-xs text-amber-600">
              Sepete eklemek için giriş yapmanız gerekir.
            </p>
          )}
        </div>
      </div>

      {/* Phone specs */}
      {(product.type === 'used_phone' || product.type === 'new_phone' || product.type === 'tablet' || product.type === 'smartwatch') && activePhoneSpecs.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{isNewPhone ? 'Ürün Özellikleri' : 'Teknik Durum Bilgileri'}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePhoneSpecs.map((spec) => (
              <div
                key={spec.label}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
                  <spec.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">{spec.label}</p>
                  <p className="text-sm font-semibold text-slate-900">{spec.value}</p>
                </div>
              </div>
            ))}
          </div>
          {product.imei && (
            <div className="mt-4 rounded-xl bg-blue-50 p-3">
              <p className="text-xs text-blue-600">IMEI</p>
              <p className="text-sm font-mono font-semibold text-blue-900">
                {product.imei.slice(0, 4)}•••••••{product.imei.slice(-2)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
