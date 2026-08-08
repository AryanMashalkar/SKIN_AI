"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/products";
import type { Garment } from "@/lib/fashion/products";
import type { SkinProfile } from "@/lib/skin";
import {
  type CartLine,
  type CartItem,
  addLine,
  removeLine,
  setLineQty,
  fromProduct,
  fromGarment,
} from "@/lib/cart";

export type { CartLine, CartItem };

interface StoreState {
  profile: SkinProfile | null;
  /** The scan before the current one, for progress comparison. */
  previousProfile: SkinProfile | null;
  /** One cart for the whole store - skincare and apparel together. */
  cart: CartLine[];
  cartOpen: boolean;
  scanOpen: boolean;

  setProfile: (p: SkinProfile | null) => void;
  clearProfile: () => void;

  addProduct: (product: Product, qty?: number) => void;
  addGarment: (garment: Garment, size: string) => void;
  removeFromCart: (id: string, size?: string) => void;
  setQty: (id: string, qty: number, size?: string) => void;
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

      addProduct: (product, qty = 1) =>
        set((s) => ({
          cart: addLine(s.cart, fromProduct(product), { qty }),
          cartOpen: true,
        })),
      addGarment: (garment, size) =>
        set((s) => ({
          cart: addLine(s.cart, fromGarment(garment), { size }),
          cartOpen: true,
        })),
      removeFromCart: (id, size) =>
        set((s) => ({ cart: removeLine(s.cart, id, size) })),
      setQty: (id, qty, size) =>
        set((s) => ({ cart: setLineQty(s.cart, id, qty, size) })),
      clearCart: () => set({ cart: [] }),

      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
      openScan: () => set({ scanOpen: true }),
      closeScan: () => set({ scanOpen: false }),
    }),
    {
      // Bumped from "derma-store": the cart shape changed from
      // { product, qty } to { item, size?, qty }, and a persisted old cart
      // would hydrate into lines whose `item` is undefined and crash the
      // drawer. A new key discards stale carts instead.
      name: "miroir-store-v2",
      partialize: (s) => ({
        profile: s.profile,
        previousProfile: s.previousProfile,
        cart: s.cart,
      }),
    },
  ),
);

export { cartCount, cartTotal } from "@/lib/cart";
