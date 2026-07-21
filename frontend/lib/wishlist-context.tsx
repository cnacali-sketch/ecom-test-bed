"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface WishlistContextValue {
  productIds: Set<string>;
  isWished: (productId: string) => boolean;
  toggleWish: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());

  const toggleWish = useCallback((productId: string) => {
    setProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const isWished = useCallback((productId: string) => productIds.has(productId), [productIds]);

  const value = useMemo<WishlistContextValue>(
    () => ({ productIds, isWished, toggleWish }),
    [productIds, isWished, toggleWish],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
