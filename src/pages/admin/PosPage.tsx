import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, X, Package, Smartphone, Tablet, Watch, CreditCard, Banknote, Building2, Wallet, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, SALES_CHANNEL_LABELS, DELIVERY_TYPE_LABELS } from '@/lib/format';
import type { ProductWithImages, SalesChannel, DeliveryType, PaymentMethod, InstallmentSetting } from '@/lib/types';
import { trError } from '@/lib/errors';

interface CartItem {
  product_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  unit_price: number;
  quantity: number;
  stock: number;
  type: string;
  imei: string | null;
  image_url: string | null;
  discount: number;
}

interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
}

export function PosPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [filtered, setFiltered] = useState<ProductWithImages[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Checkout form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [salesChannel, setSalesChannel] = useState<SalesChannel>('POS');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('GEL_AL');
  const [note, setNote] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: 'cash', amount: 0 }]);
  const [installments, setInstallments] = useState<InstallmentSetting[]>([]);
  const [installmentCount, setInstallmentCount] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const [{ data: prodData }, { data: catData }] = await Promise.all([
      supabase.from('products').select('*, product_images(*)').eq('is_active', true).order('name'),
      supabase.from('categories').select('id, name').order('name'),
    ]);
    setProducts((prodData as ProductWithImages[]) || []);
    setCategories((catData as { id: string; name: string }[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
    supabase.rpc('get_installment_options').then(({ data }) => {
      setInstallments((data as InstallmentSetting[]) || []);
    });
  }, [loadProducts]);

  useEffect(() => {
    let result = products;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q)) ||
        (p.imei && p.imei.includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q))
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category_id === categoryFilter);
    }
    setFiltered(result);
  }, [search, products, categoryFilter]);

  // Keyboard shortcut: focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const subtotal = cart.reduce((s, i) => s + (i.unit_price * i.quantity - i.discount), 0);
  const total = subtotal - globalDiscount;
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - totalPayments;

  const addToCart = (product: ProductWithImages) => {
    setError('');
    const existing = cart.find(i => i.product_id === product.id);
    if (product.imei) {
      if (existing) {
        setError('Bu IMEI li cihaz sepette zaten var');
        return;
      }
    }
    if (existing) {
      if (existing.quantity >= product.stock) {
        setError('Yetersiz stok');
        return;
      }
      setCart(cart.map(i =>
        i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      if (product.stock <= 0) {
        setError('Bu ürünün stoğu yok');
        return;
      }
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        unit_price: product.sale_price,
        quantity: 1,
        stock: product.stock,
        type: product.type,
        imei: product.imei,
        image_url: product.product_images?.[0]?.image_url || null,
        discount: 0,
      }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(i => {
      if (i.product_id !== id) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.stock) return i;
      return { ...i, quantity: newQty };
    }));
  };

  const updateDiscount = (id: string, discount: number) => {
    setCart(cart.map(i =>
      i.product_id === id ? { ...i, discount: Math.min(discount, i.unit_price * i.quantity) } : i
    ));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(i => i.product_id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setGlobalDiscount(0);
    setPayments([{ method: 'cash', amount: 0 }]);
    setInstallmentCount(1);
  };

  const hasCardPayment = payments.some(p => ['card', 'card_on_delivery', 'online_card'].includes(p.method));
  const selectedInstallment = installments.find(i => i.installment_count === installmentCount);
  const installmentInterest = selectedInstallment && installmentCount > 1 ? total * selectedInstallment.interest_rate : 0;
  const installmentTotal = total + installmentInterest;
  const installmentMonthly = installmentCount > 0 ? installmentTotal / installmentCount : installmentTotal;

  const updatePayment = (idx: number, field: 'method' | 'amount', value: string | number) => {
    setPayments(payments.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    ));
  };

  const addPaymentRow = () => {
    setPayments([...payments, { method: 'card', amount: 0 }]);
  };

  const removePaymentRow = (idx: number) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== idx));
    }
  };

  const handleCheckout = async () => {
    if (saving) return;
    setError('');
    setSuccess('');

    if (cart.length === 0) {
      setError('Sepet boş');
      return;
    }
    if (!customerName.trim()) {
      setError('Müşteri adı zorunludur');
      return;
    }
    if (totalPayments < total) {
      setError(`Ödeme yetersiz. Kalan: ${formatPrice(remaining)}`);
      return;
    }

    setSaving(true);
    const itemsJson = cart.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount,
    }));
    const paymentsJson = payments.filter(p => p.amount > 0).map(p => ({
      payment_method: p.method,
      amount: p.amount,
    }));

    const { data, error: err } = await supabase.rpc('create_sale', {
      p_sales_channel: salesChannel,
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone.trim() || null,
      p_customer_email: customerEmail.trim() || (profile?.email || 'pos@ms-iletisim.com'),
      p_user_id: null,
      p_items: itemsJson,
      p_payments: paymentsJson,
      p_delivery_type: deliveryType,
      p_note: note.trim() || null,
      p_discount: globalDiscount,
      p_installment_count: hasCardPayment ? installmentCount : 1,
    });

    if (err) {
      setError('Satış hatası: ' + trError(err));
      setSaving(false);
      return;
    }

    setSuccess('Satış başarıyla tamamlandı! Sipariş No: ' + data);
    clearCart();
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setNote('');
    setCheckoutOpen(false);
    setSaving(false);
    loadProducts();
    setTimeout(() => setSuccess(''), 5000);
  };

  const paymentIcons: Record<string, typeof Banknote> = {
    cash: Banknote,
    cash_on_delivery: Banknote,
    card: CreditCard,
    card_on_delivery: CreditCard,
    online_card: CreditCard,
    bank_transfer: Building2,
    havale: Building2,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Sol: Ürün listesi */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Ürün, barkod veya IMEI ara... (/ ile odaklan)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              autoFocus
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              <Package className="mr-2 h-5 w-5" /> Ürün bulunamadı
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="group flex flex-col rounded-xl border border-slate-200 p-3 text-left transition-all hover:border-slate-900 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="mb-2 h-20 w-full overflow-hidden rounded-lg bg-slate-100">
                    {product.product_images?.[0] ? (
                      <img src={product.product_images[0].image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        {product.type === 'accessory' ? <Package className="h-8 w-8" /> : product.type === 'tablet' ? <Tablet className="h-8 w-8" /> : product.type === 'smartwatch' ? <Watch className="h-8 w-8" /> : <Smartphone className="h-8 w-8" />}
                      </div>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                  <p className="truncate text-xs text-slate-400">{product.brand} {product.model}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{formatPrice(product.sale_price)}</span>
                    <span className={`text-xs ${product.stock <= 0 ? 'text-red-500' : product.stock <= (product.min_stock_level || 5) ? 'text-amber-500' : 'text-slate-400'}`}>
                      Stok: {product.stock}
                    </span>
                  </div>
                  {product.imei && (
                    <Badge variant="info" className="mt-1 self-start">IMEI li</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sağ: Sepet */}
      <div className="lg:w-96 flex flex-col">
        <div className="flex items-center justify-between rounded-t-2xl border border-b-0 border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-slate-700" />
            <h2 className="font-bold text-slate-900">Sepet ({cart.length})</h2>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">Temizle</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto border-x border-slate-200 bg-white p-3">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              <ShoppingCart className="mr-2 h-6 w-6" /> Sepet boş
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.product_id} className="rounded-xl border border-slate-100 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.brand} {item.model}</p>
                      {item.imei && <p className="text-xs text-blue-500">IMEI: {item.imei}</p>}
                    </div>
                    <button onClick={() => removeFromCart(item.product_id)} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product_id, -1)} className="rounded-lg border border-slate-200 p-1 hover:bg-slate-100">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, 1)} className="rounded-lg border border-slate-200 p-1 hover:bg-slate-100">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatPrice(item.unit_price * item.quantity - item.discount)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-xs text-slate-400">İndirim:</span>
                    <input
                      type="number" placeholder="0"
                      min={0}
                      value={(item.discount) || ''}
                      onChange={(e) => updateDiscount(item.product_id, Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-white p-3">
          <div className="mb-2 space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Ara Toplam</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Genel İndirim</span>
              <input
                type="number" placeholder="0"
                min={0}
                value={(globalDiscount) || ''}
                onChange={(e) => setGlobalDiscount(Math.min(Number(e.target.value), subtotal))}
                className="w-24 rounded-lg border border-slate-200 px-2 py-0.5 text-right text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold text-slate-900">
              <span>Toplam</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0}
            onClick={() => { setCheckoutOpen(true); setError(''); }}
          >
            <Wallet className="h-4 w-4" />
            Ödemeye Geç
          </Button>
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCheckoutOpen(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900">Ödeme</h2>
              <button onClick={() => setCheckoutOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

              {/* Müşteri bilgileri */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Müşteri Bilgileri</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Müşteri Adı *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ad Soyad" />
                  <Input label="Telefon" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="05XX XXX XX XX" />
                  <Input label="E-posta" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@ornek.com" />
                </div>
              </div>

              {/* Satış kanalı */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Satış Kanalı</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {(['POS', 'GEL_AL', 'KURYE', 'SERVIS', 'ONLINE'] as SalesChannel[]).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setSalesChannel(ch)}
                      className={`rounded-xl border p-2 text-xs font-medium ${salesChannel === ch ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'}`}
                    >
                      {SALES_CHANNEL_LABELS[ch]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Teslimat */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Teslimat Yöntemi</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['GEL_AL', 'KURYE'] as DeliveryType[]).map(dt => (
                    <button
                      key={dt}
                      onClick={() => setDeliveryType(dt)}
                      className={`rounded-xl border p-2.5 text-sm font-medium ${deliveryType === dt ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
                    >
                      {DELIVERY_TYPE_LABELS[dt]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ödemeler */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Ödeme Yöntemleri (Parçalı Ödeme)</h3>
                <div className="space-y-2">
                  {payments.map((pay, idx) => {
                    const Icon = paymentIcons[pay.method] || Banknote;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <select
                            value={pay.method}
                            onChange={(e) => updatePayment(idx, 'method', e.target.value)}
                            className="text-sm focus:outline-none"
                          >
                            <option value="cash">Nakit</option>
                            <option value="card">Kart</option>
                            <option value="bank_transfer">Havale/EFT</option>
                            <option value="cash_on_delivery">Kapıda Nakit</option>
                            <option value="card_on_delivery">Kapıda Kart</option>
                            <option value="online_card">Online Kart</option>
                          </select>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={pay.amount || ''}
                          onChange={(e) => updatePayment(idx, 'amount', Number(e.target.value))}
                          placeholder="Tutar"
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                        />
                        {payments.length > 1 && (
                          <button onClick={() => removePaymentRow(idx)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={addPaymentRow} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                    <Plus className="h-4 w-4" /> Ödeme Ekle
                  </button>
                </div>
              </div>

              {/* Taksit seçimi - sadece kart ödemesi varsa */}
              {hasCardPayment && installments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold text-slate-900">Taksit Seçimi</h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {installments.map(opt => (
                      <button
                        key={opt.installment_count}
                        onClick={() => setInstallmentCount(opt.installment_count)}
                        className={`rounded-xl border p-2 text-xs font-medium ${installmentCount === opt.installment_count ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {installmentCount > 1 && selectedInstallment && (
                    <div className="mt-2 rounded-xl bg-blue-50 p-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Vade Farkı (%{(selectedInstallment.interest_rate * 100).toFixed(0)}):</span>
                        <span>{formatPrice(installmentInterest)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{installmentCount} × Taksit:</span>
                        <span>{formatPrice(installmentMonthly)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Toplam:</span>
                        <span className="font-bold">{formatPrice(installmentTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Not */}
              <Input label="Sipariş Notu" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsiyonel not" />

              {/* Özet */}
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Sepet Toplamı</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>İndirim</span>
                  <span>-{formatPrice(globalDiscount)}</span>
                </div>
                {installmentCount > 1 && hasCardPayment && (
                  <div className="flex justify-between text-blue-600">
                    <span>Vade Farkı</span>
                    <span>{formatPrice(installmentInterest)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-900">
                  <span>Toplam</span>
                  <span>{formatPrice(hasCardPayment && installmentCount > 1 ? installmentTotal : total)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Ödenen</span>
                  <span className="font-medium text-emerald-600">{formatPrice(totalPayments)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Kalan</span>
                    <span>{formatPrice(remaining)}</span>
                  </div>
                )}
              </div>

              <Button className="w-full" size="lg" loading={saving} onClick={handleCheckout}>
                <CheckCircle className="h-4 w-4" />
                Satışı Tamamla ({formatPrice(hasCardPayment && installmentCount > 1 ? installmentTotal : total)})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
