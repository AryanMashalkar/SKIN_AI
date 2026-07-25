"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Garment } from "@/lib/fashion/products";

export interface FashionCartLine {
  garment: Garment;
  size: string;
  qty: number;
}

export interface UserPhoto {
  dataUrl: string; // full-res data URL sent to the server
  previewUrl: string; // smaller preview for the UI
}

export type TryOnStatus = "idle" | "running" | "done" | "error";

interface FashionState {
  userPhoto: UserPhoto | null;
  results: Record<string, string>; // garmentId -> result image URL
  status: Record<string, TryOnStatus>;
  cart: FashionCartLine[];

  tryOnFor: string | null; // garment id whose modal is open
  cartOpen: boolean;

  setUserPhoto: (p: UserPhoto | null) => void;
  setResult: (garmentId: string, url: string) => void;
  setStatus: (garmentId: string, s: TryOnStatus) => void;

  addToCart: (garment: Garment, size: string) => void;
  removeFromCart: (garmentId: string, size: string) => void;
  setQty: (garmentId: string, size: string, qty: number) => void;
  clearCart: () => void;

  openTryOn: (garmentId: string) => void;
  closeTryOn: () => void;
  openCart: () => void;
  closeCart: () => void;
}

export const useFashion = create<FashionState>()(
  persist(
    (set) => ({
      userPhoto: null,
      results: {},
      status: {},
      cart: [],
      tryOnFor: null,
      cartOpen: false,

      setUserPhoto: (p) => set({ userPhoto: p }),
      setResult: (garmentId, url) =>
        set((s) => ({ results: { ...s.results, [garmentId]: url } })),
      setStatus: (garmentId, st) =>
        set((s) => ({ status: { ...s.status, [garmentId]: st } })),

      addToCart: (garment, size) =>
        set((s) => {
          const existing = s.cart.find(
            (l) => l.garment.id === garment.id && l.size === size,
          );
          if (existing) {
            return {
              cart: s.cart.map((l) =>
                l.garment.id === garment.id && l.size === size
                  ? { ...l, qty: l.qty + 1 }
                  : l,
              ),
              cartOpen: true,
            };
          }
          return { cart: [...s.cart, { garment, size, qty: 1 }], cartOpen: true };
        }),
      removeFromCart: (garmentId, size) =>
        set((s) => ({
          cart: s.cart.filter(
            (l) => !(l.garment.id === garmentId && l.size === size),
          ),
        })),
      setQty: (garmentId, size, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter(
                  (l) => !(l.garment.id === garmentId && l.size === size),
                )
              : s.cart.map((l) =>
                  l.garment.id === garmentId && l.size === size
                    ? { ...l, qty }
                    : l,
                ),
        })),
      clearCart: () => set({ cart: [] }),

      openTryOn: (garmentId) => set({ tryOnFor: garmentId }),
      closeTryOn: () => set({ tryOnFor: null }),
      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
    }),
    {
      name: "derma-fashion",
      // Persist cart + the chosen photo so try-ons survive reloads.
      partialize: (s) => ({ cart: s.cart, userPhoto: s.userPhoto }),
    },
  ),
);

export function fashionCartCount(cart: FashionCartLine[]): number {
  return cart.reduce((n, l) => n + l.qty, 0);
}

export function fashionCartTotal(cart: FashionCartLine[]): number {
  return cart.reduce((n, l) => n + l.qty * l.garment.price, 0);
}
