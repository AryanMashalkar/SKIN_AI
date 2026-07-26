"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/products";
import type { SkinProfile } from "@/lib/skin";

export interface CartLine {
  product: Product;
  qty: number;
}

interface StoreState {
  profile: SkinProfile | null;
  /** The scan before the current one, for progress comparison. */
  previousProfile: SkinProfile | null;
  cart: CartLine[];
  cartOpen: boolean;
  scanOpen: boolean;

  setProfile: (p: SkinProfile | null) => void;
  clearProfile: () => void;

  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;

  openCart: () => void;
  closeCart: () => void;
  openScan: () => void;
  closeScan: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      profile: null,
      previousProfile: null,
      cart: [],
      cartOpen: false,
      scanOpen: false,

      // A new scan pushes the old one into `previousProfile` so the report can
      // show progress. Demo/simulated scans never become a baseline.
      setProfile: (p) =>
        set((s) => ({
          profile: p,
          previousProfile:
            p && s.profile && !s.profile.demo ? s.profile : s.previousProfile,
        })),
      clearProfile: () => set({ profile: null, previousProfile: null }),

      addToCart: (product, qty = 1) =>
        set((s) => {
          const existing = s.cart.find((l) => l.product.id === product.id);
          if (existing) {
            return {
              cart: s.cart.map((l) =>
                l.product.id === product.id ? { ...l, qty: l.qty + qty } : l,
              ),
              cartOpen: true,
            };
          }
          return { cart: [...s.cart, { product, qty }], cartOpen: true };
        }),
      removeFromCart: (id) =>
        set((s) => ({ cart: s.cart.filter((l) => l.product.id !== id) })),
      setQty: (id, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter((l) => l.product.id !== id)
              : s.cart.map((l) =>
                  l.product.id === id ? { ...l, qty } : l,
                ),
        })),
      clearCart: () => set({ cart: [] }),

      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
      openScan: () => set({ scanOpen: true }),
      closeScan: () => set({ scanOpen: false }),
    }),
    {
      name: "derma-store",
      partialize: (s) => ({
        profile: s.profile,
        previousProfile: s.previousProfile,
        cart: s.cart,
      }),
    },
  ),
);

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty * l.product.price, 0);
}
