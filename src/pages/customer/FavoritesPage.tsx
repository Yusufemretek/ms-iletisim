import { useEffect, useState, useCallback } from 'react';
import { Heart, ShoppingCart, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/format';
import { navigate } from '@/lib/router';
import type { ProductWithImages } from '@/lib/types';

export function FavoritesPage() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [favorites, setFavorites] = useState<ProductWithImages[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('favorites')
      .select('product_id, products!inner(*, product_images(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const items = ((data as unknown as { product_id: string; products: ProductWithImages }[]) || []).map(d => d.products);
    setFavorites(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadFavorites();
  }, [user, loadFavorites]);

  const handleRemove = async (productId: string) => {
    await supabase.rpc('toggle_favorite', { p_product_id: productId });
    loadFavorites();
  };

  const handleAddToCart = (product: ProductWithImages) => {
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      model: product.model,
      unit_price: product.sale_price,
      quantity: 1,
      stock: product.stock,
      image_url: product.product_images?.[0]?.image_url || null,
      type: product.type,
      imei: product.imei || null,
    });
    navigate('/cart');
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold text-slate-800">
        <Heart className="h-6 w-6 text-rose-400" />
        Favorilerim
      </h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-white" />)}
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">Henüz favori ürününüz yok.</p>
          <button onClick={() => navigate('/urunler')} className="mt-4 text-sm font-medium text-electric-600 hover:text-electric-600">
            Ürünleri Keşfet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {favorites.map(product => (
            <div key={product.id} className="premium-card group overflow-hidden">
              <button onClick={() => navigate(product.slug ? `/urun/${product.slug}` : `/product/${product.id}`)} className="block w-full text-left">
                <div className="relative aspect-square overflow-hidden bg-slate-50">
                  {product.product_images?.[0] ? (
                    <img src={product.product_images[0].image_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <ShoppingCart className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  {product.brand && <p className="text-xs text-slate-400">{product.brand}</p>}
                  <h3 className="truncate text-sm font-semibold text-slate-800">{product.name}</h3>
                  <p className="mt-1 text-base font-bold text-electric-600">{formatPrice(product.sale_price)}</p>
                </div>
              </button>
              <div className="flex gap-2 p-3 pt-0">
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={product.stock <= 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-electric-50 py-2 text-xs font-medium text-electric-600 hover:bg-electric-100 disabled:opacity-40"
                >
                  <ShoppingCart className="h-3.5 w-3.5" /> Sepete Ekle
                </button>
                <button
                  onClick={() => handleRemove(product.id)}
                  className="flex items-center justify-center rounded-lg bg-red-50 px-2 py-2 text-red-500 hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
