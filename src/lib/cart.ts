"use client";

// One cart for the whole store.
//
// Previously there were two: `store.ts` held skincare lines keyed by product id
// and `fashion/store.ts` held apparel lines keyed by id+size, with two nearly
// identical drawer components on top. That is a duplication problem, but more
// importantly it is a PRODUCT problem: two carts is the clearest possible
// signal that a shopper is in two different stores, which is exactly what a
// single skin-driven experience must not feel like.
//
// The logic here is pure and separately tested. The store just holds the array.

import type { Product } from "@/lib/products";
import type { Garment } from "@/lib/fashion/products";

export type CartKind = "skincare" | "apparel";

/** The minimum a cart needs to know about anything sold. */
export interface CartItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  kind: CartKind;
  accent: [string, string];
  /** Apparel: public image path. Skincare renders a generated SVG instead. */
  image?: string;
  /** Skincare: drives the generated bottle artwork. */
  category?: string;
}

export interface CartLine {
  item: CartItem;
  /** Apparel only. Undefined for skincare. */
  size?: string;
  qty: number;
}

export function fromProduct(p: Product): CartItem {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    kind: "skincare",
    accent: p.accent,
    category: p.category,
  };
}

export function fromGarment(g: Garment): CartItem {
  return {
    id: g.id,
    name: g.name,
    brand: g.brand,
    price: g.price,
    kind: "apparel",
    accent: g.accent,
    image: g.image,
  };
}

/**
 * Identity of a cart line. Size is part of the key so a medium and a large of
 * the same shirt are separate lines, while skincare (no size) collapses to the
 * product id.
 */
export function lineKey(id: string, size?: string): string {
  return size ? `${id}::${size}` : id;
}

const keyOf = (l: CartLine) => lineKey(l.item.id, l.size);

export function addLine(
  cart: CartLine[],
  item: CartItem,
  opts: { size?: string; qty?: number } = {},
): CartLine[] {
  const { size, qty = 1 } = opts;
  const key = lineKey(item.id, size);
  const existing = cart.find((l) => keyOf(l) === key);
  if (existing) {
    return cart.map((l) => (keyOf(l) === key ? { ...l, qty: l.qty + qty } : l));
  }
  return [...cart, { item, size, qty }];
}

export function removeLine(cart: CartLine[], id: string, size?: string): CartLine[] {
  const key = lineKey(id, size);
  return cart.filter((l) => keyOf(l) !== key);
}

export function setLineQty(
  cart: CartLine[],
  id: string,
  qty: number,
  size?: string,
): CartLine[] {
  const key = lineKey(id, size);
  if (qty <= 0) return removeLine(cart, id, size);
  return cart.map((l) => (keyOf(l) === key ? { ...l, qty } : l));
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty * l.item.price, 0);
}

/** Free over the threshold, and never charged on an empty cart. */
export const SHIPPING_THRESHOLD = 60;
export const SHIPPING_FLAT = 6;

export function shippingFor(subtotal: number): number {
  return subtotal >= SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FLAT;
}

/** Groups lines for display, so one drawer can show both kinds coherently. */
export function groupByKind(cart: CartLine[]): Record<CartKind, CartLine[]> {
  return {
    skincare: cart.filter((l) => l.item.kind === "skincare"),
    apparel: cart.filter((l) => l.item.kind === "apparel"),
  };
}
