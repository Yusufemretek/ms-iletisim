import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, ImageOff } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/format';
import { navigate } from '@/lib/router';

export function CartPage() {
  const { items, total, updateQuantity, removeItem } = useCart();
  const { user } = useAuth();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
          <ShoppingCart className="h-10 w-10 text-slate-300" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Sepetiniz Boş</h1>
        <p className="mt-1 text-sm text-slate-500">
          Henüz sepetinize ürün eklemediniz.
        </p>
        <Button className="mt-6" onClick={() => navigate('/urunler')}>
          Ürünleri İncele
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Sepetim</h1>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              <button
                onClick={() => navigate(`/product/${item.product_id}`)}
                className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
              >
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </button>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {item.brand && (
                      <p className="text-xs text-slate-400">{item.brand}</p>
                    )}
                    <button
                      onClick={() => navigate(`/product/${item.product_id}`)}
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {item.name}
                    </button>
                    {item.model && (
                      <p className="text-xs text-slate-500">{item.model}</p>
                    )}
                    {item.variant_storage && (
                      <p className="mt-0.5 text-xs font-medium text-slate-600">Hafıza: {item.variant_storage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id, item.variant_id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-slate-300">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.variant_id)}
                      className="p-1.5 text-slate-600 disabled:opacity-30"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.variant_id)}
                      className="p-1.5 text-slate-600 disabled:opacity-30"
                      disabled={item.quantity >= item.stock}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      {formatPrice(item.unit_price)} / adet
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatPrice(item.unit_price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">Sipariş Özeti</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ara Toplam</span>
                <span className="font-medium text-slate-900">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Teslimat</span>
                <span className="font-medium text-emerald-600">Elden Ücretsiz</span>
              </div>
              <div className="border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-900">Toplam</span>
                  <span className="text-xl font-bold text-slate-900">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={() => navigate(user ? '/checkout' : '/login')}
            >
              {user ? 'Siparişi Tamamla' : 'Giriş Yap & Devam Et'}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {!user && (
              <p className="mt-2 text-center text-xs text-amber-600">
                Sipariş vermek için giriş yapmalısınız.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
