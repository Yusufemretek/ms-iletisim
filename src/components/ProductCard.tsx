import { useState, useEffect } from 'react';
import { ShoppingCart, ImageOff, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/format';
import type { ProductWithImages } from '@/lib/types';
import { navigate } from '@/lib/router';
import { useCart } from '@/context/CartContext';
import { getActiveCampaigns, getCampaignForProduct, applyDiscount, type Campaign } from '@/lib/campaigns';

export function ProductCard({ product }: { product: ProductWithImages }) {
  const { addItem } = useCart();
  const primaryImage = product.product_images?.find((i) => i.is_primary) || product.product_images?.[0];
  const inStock = product.stock > 0 && product.is_active;
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    (async () => {
      const campaigns = await getActiveCampaigns();
      setCampaign(getCampaignForProduct(product.id, product.category_id || null, campaigns));
    })();
  }, [product.id, product.category_id]);

  const finalPrice = campaign ? applyDiscount(product.sale_price, campaign) : product.sale_price;
  const hasDiscount = campaign && finalPrice < product.sale_price;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!inStock) return;
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      model: product.model,
      unit_price: finalPrice,
      quantity: 1,
      stock: product.stock,
      image_url: primaryImage?.image_url || null,
      type: product.type,
      imei: product.imei || null,
    });
  };

  return (
    <div
      onClick={() => navigate(product.slug ? `/urun/${product.slug}` : `/product/${product.id}`)}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:border-electric-300 hover:shadow-lg hover:shadow-electric-500/10"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {primaryImage ? (
          <img
            src={primaryImage.image_url}
            alt={product.name}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff className="h-12 w-12" />
          </div>
        )}
        {product.type === 'used_phone' && (
          <div className="absolute left-2 top-2">
            <Badge variant="info">2. El</Badge>
          </div>
        )}
        {product.type === 'new_phone' && (
          <div className="absolute left-2 top-2">
            <Badge variant="success">Sıfır</Badge>
          </div>
        )}
        {product.type === 'tablet' && (
          <div className="absolute left-2 top-2">
            <Badge variant="warning">Tablet</Badge>
          </div>
        )}
        {product.type === 'smartwatch' && (
          <div className="absolute left-2 top-2">
            <Badge variant="warning">Akıllı Saat</Badge>
          </div>
        )}
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-white">
              STOKTA YOK
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        {product.brand && (
          <p className="text-xs font-medium text-slate-400">{product.brand}</p>
        )}
        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-800">
          {product.name}
        </h3>
        {product.model && (
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{product.model}</p>
        )}

        <div className="mt-auto pt-2">
          {hasDiscount && (
            <div className="mb-1 flex items-center gap-1.5">
              <Badge variant="error"><Tag className="mr-0.5 inline h-3 w-3" />{campaign!.discount_type === 'percentage' ? `%${campaign!.discount_value}` : `${formatPrice(campaign!.discount_value)}`}</Badge>
              <span className="text-xs text-slate-400 line-through">{formatPrice(product.sale_price)}</span>
            </div>
          )}
          <div className="flex items-end justify-between">
            <span className="text-lg font-bold text-electric-600">
              {formatPrice(finalPrice)}
            </span>
            {inStock ? (
              <span className="text-xs text-emerald-600">Stokta {product.stock}</span>
            ) : (
              <span className="text-xs text-red-500">Stokta Yok</span>
            )}
          </div>
          <Button
            size="sm"
            variant={inStock ? 'primary' : 'outline'}
            disabled={!inStock}
            onClick={handleAdd}
            className="mt-2 w-full"
          >
            <ShoppingCart className="h-4 w-4" />
            {inStock ? 'Sepete Ekle' : 'Stokta Yok'}
          </Button>
        </div>
      </div>
    </div>
  );
}
