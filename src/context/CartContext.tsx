import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { CartItem } from '@/lib/types';

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (product_id: string, variant_id?: string | null) => void;
  updateQuantity: (product_id: string, quantity: number, variant_id?: string | null) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = 'ms-cart';

function itemKey(productId: string, variantId: string | null | undefined): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    if (item.stock <= 0) return;
    setItems((prev) => {
      const key = itemKey(item.product_id, item.variant_id);
      const existing = prev.find((i) => itemKey(i.product_id, i.variant_id) === key);
      if (existing) {
        const newQty = Math.min(existing.quantity + item.quantity, item.stock);
        return prev.map((i) =>
          itemKey(i.product_id, i.variant_id) === key ? { ...i, quantity: newQty } : i,
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string | null) => {
    const key = itemKey(productId, variantId);
    setItems((prev) => prev.filter((i) => itemKey(i.product_id, i.variant_id) !== key));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variantId?: string | null) => {
    const key = itemKey(productId, variantId);
    setItems((prev) =>
      prev
        .map((i) =>
          itemKey(i.product_id, i.variant_id) === key
            ? { ...i, quantity: Math.max(0, Math.min(quantity, i.stock)) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, count, total, addItem, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
