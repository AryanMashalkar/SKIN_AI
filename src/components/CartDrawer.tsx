"use client";

// The single bag for the whole store.
//
// Replaces the previous pair of near-identical drawers (CartDrawer for skincare,
// FashionCart for apparel). Lines from both sides are grouped under headings so
// one bag reads as one store rather than two tabs sharing a checkout.

import { useState } from "react";
import { X, Minus, Plus, Trash2, ShoppingBag, CheckCircle2, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  cartTotal,
  shippingFor,
  groupByKind,
  type CartLine,
  type CartKind,
} from "@/lib/cart";
import { useHydrated } from "@/lib/useHydrated";
import { ProductImage } from "@/components/ProductImage";
import { productById } from "@/lib/products";

type View = "cart" | "checkout" | "done";

const KIND_LABEL: Record<CartKind, string> = {
  skincare: "For your skin",
  apparel: "In your colours",
};

export function CartDrawer() {
  const open = useStore((s) => s.cartOpen);
  const close = useStore((s) => s.closeCart);
  const cart = useStore((s) => s.cart);
  const setQty = useStore((s) => s.setQty);
  const removeFromCart = useStore((s) => s.removeFromCart);
  const clearCart = useStore((s) => s.clearCart);
  const hydrated = useHydrated();

  const [view, setView] = useState<View>("cart");

  const lines = hydrated ? cart : [];
  const subtotal = cartTotal(lines);
  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;
  const grouped = groupByKind(lines);

  function handleClose() {
    close();
    setTimeout(() => setView("cart"), 300);
  }

  function placeOrder() {
    setView("done");
    clearCart();
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Shopping bag"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-stone-900">
            <ShoppingBag className="h-5 w-5" />
            {view === "checkout" ? "Checkout" : view === "done" ? "Order placed" : "Your bag"}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close bag"
            className="grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {view === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <h3 className="text-xl font-semibold text-stone-900">Thank you!</h3>
            <p className="text-sm text-stone-500">
              This is a demo storefront — no order was placed, no payment was
              taken and no email was sent.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
            >
              Continue shopping
            </button>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-stone-500">
            <ShoppingBag className="h-10 w-10 text-stone-300" />
            <p className="font-medium text-stone-700">Your bag is empty</p>
            <p className="text-sm">Scan your skin to get matched picks.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {(["skincare", "apparel"] as CartKind[]).map((kind) =>
                grouped[kind].length === 0 ? null : (
                  <section key={kind} className="space-y-3">
                    {/* Only label the groups when the bag actually mixes both. */}
                    {grouped.skincare.length > 0 && grouped.apparel.length > 0 && (
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                        {KIND_LABEL[kind]}
                      </h3>
                    )}
                    {grouped[kind].map((line) => (
                      <Line
                        key={`${line.item.id}::${line.size ?? ""}`}
                        line={line}
                        onQty={(q) => setQty(line.item.id, q, line.size)}
                        onRemove={() => removeFromCart(line.item.id, line.size)}
                      />
                    ))}
                  </section>
                ),
              )}

              {view === "checkout" && (
                <div className="space-y-3 rounded-2xl border border-stone-100 p-4">
                  <p className="text-sm font-semibold text-stone-900">
                    Shipping details
                  </p>
                  <Field label="Full name" placeholder="Alex Morgan" />
                  <Field label="Email" placeholder="alex@email.com" type="email" />
                  <Field label="Address" placeholder="123 Glow Ave" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City" placeholder="New York" />
                    <Field label="ZIP" placeholder="10001" />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
                    <Lock className="h-3.5 w-3.5" /> Demo checkout — no real
                    payment is processed.
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-stone-100 p-5">
              <div className="space-y-1 text-sm">
                <Row label="Subtotal" value={`$${subtotal}`} />
                <Row
                  label="Shipping"
                  value={shipping === 0 ? "Free" : `$${shipping}`}
                />
                <div className="flex items-center justify-between pt-1 text-base font-semibold text-stone-900">
                  <span>Total</span>
                  <span>${total}</span>
                </div>
              </div>
              {view === "cart" ? (
                <button
                  onClick={() => setView("checkout")}
                  className="w-full rounded-full bg-stone-900 py-3 font-medium text-white transition hover:bg-stone-700"
                >
                  Checkout
                </button>
              ) : (
                <button
                  onClick={placeOrder}
                  className="w-full rounded-full bg-gradient-to-r from-[#b5451f] to-[#d9a679] py-3 font-medium text-white transition hover:opacity-90"
                >
                  Place order · ${total}
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function Line({
  line,
  onQty,
  onRemove,
}: {
  line: CartLine;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const { item } = line;
  // Skincare tiles are generated SVG and need the full Product record.
  const product = item.kind === "skincare" ? productById(item.id) : undefined;

  return (
    <div className="flex gap-3 rounded-2xl border border-stone-100 p-3">
      <span
        className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${item.accent[0]}22, ${item.accent[1]}33)`,
        }}
      >
        {product ? (
          <ProductImage product={product} className="h-12 w-auto" />
        ) : item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold leading-tight text-stone-900">
              {item.name}
            </p>
            <p className="text-xs text-stone-400">
              {item.brand}
              {line.size && ` · Size ${line.size}`}
            </p>
          </div>
          <button
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="text-stone-300 hover:text-rose-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full border border-stone-200">
            <button
              onClick={() => onQty(line.qty - 1)}
              aria-label="Decrease quantity"
              className="grid h-7 w-7 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center text-sm font-medium">{line.qty}</span>
            <button
              onClick={() => onQty(line.qty + 1)}
              aria-label="Increase quantity"
              className="grid h-7 w-7 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-sm font-semibold text-stone-900">
            ${item.price * line.qty}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-stone-500">
      <span>{label}</span>
      <span className="font-medium text-stone-700">{value}</span>
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none transition focus:border-[#b5451f] focus:ring-2 focus:ring-[#f4ead9]"
      />
    </label>
  );
}
