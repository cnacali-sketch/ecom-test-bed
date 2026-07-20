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
}

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

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  // Adds to cart WITHOUT opening the drawer. Callers that want the drawer
  // (e.g. the PDP) call openCart() themselves; the product-grid inline stepper
  // deliberately stays on the page instead of interrupting browsing.
  const addItem = useCallback((item: CartItem) => {
    setItems((current) => mergeCartItem(current, item));
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
  }, []);

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
    }),
    [items, isOpen, itemCount, subtotal, openCart, closeCart, addItem, removeItem, updateQuantity],
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
