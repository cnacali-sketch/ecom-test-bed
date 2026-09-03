"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { CartItem } from "./types";

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  subtotal: number;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  /** Empty the cart — called after a successful checkout. */
  clearCart: () => void;
  /** Most recently added item, for the mobile "Added!" toast. Null once dismissed. */
  justAdded: CartItem | null;
  dismissJustAdded: () => void;
}

// Tailwind's `sm` breakpoint — kept in sync with the sm: classes in
// CartDrawer/AddedToast that switch between the two add-to-cart treatments.
const DESKTOP_QUERY = "(min-width: 640px)";

const CartContext = createContext<CartContextValue | undefined>(undefined);

function mergeCartItem(items: CartItem[], newItem: CartItem): CartItem[] {
  const existing = items.find((item) => item.variantId === newItem.variantId);

  if (!existing) {
    return [...items, newItem];
  }

  return items.map((item) =>
    item.variantId === newItem.variantId
      ? { ...item, quantity: item.quantity + newItem.quantity }
      : item,
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<CartItem | null>(null);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const dismissJustAdded = useCallback(() => setJustAdded(null), []);

  // Desktop gets the full cart popover on every add (customer sees the
  // updated cart and can check out immediately). Mobile stays on the page —
  // a brief "Added!" toast (AddedToast.tsx) instead, since a full-screen
  // sheet after every tap would interrupt browsing on a small screen.
  const addItem = useCallback((item: CartItem) => {
    setItems((current) => mergeCartItem(current, item));
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      setIsOpen(true);
    } else {
      setJustAdded(item);
    }
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((current) => {
      if (quantity <= 0) {
        return current.filter((item) => item.variantId !== variantId);
      }
      return current.map((item) =>
        item.variantId === variantId ? { ...item, quantity } : item,
      );
    });
  }, []);

  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      isOpen,
      itemCount,
      subtotal,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      justAdded,
      dismissJustAdded,
    }),
    [
      items,
      isOpen,
      itemCount,
      subtotal,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      justAdded,
      dismissJustAdded,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
