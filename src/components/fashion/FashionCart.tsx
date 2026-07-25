"use client";

import { useState } from "react";
import { X, Minus, Plus, Trash2, ShoppingBag, CheckCircle2, Lock } from "lucide-react";
import { fashionCartTotal, useFashion } from "@/lib/fashion/store";
import { useHydrated } from "@/lib/useHydrated";

type View = "cart" | "checkout" | "done";

export function FashionCart() {
  const open = useFashion((s) => s.cartOpen);
  const close = useFashion((s) => s.closeCart);
  const cart = useFashion((s) => s.cart);
  const setQty = useFashion((s) => s.setQty);
  const removeFromCart = useFashion((s) => s.removeFromCart);
  const clearCart = useFashion((s) => s.clearCart);
  const hydrated = useHydrated();

  const [view, setView] = useState<View>("cart");
  const lines = hydrated ? cart : [];
  const subtotal = fashionCartTotal(lines);
  const shipping = subtotal > 150 || subtotal === 0 ? 0 : 12;
  const total = subtotal + shipping;

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
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-neutral-950 text-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShoppingBag className="h-5 w-5" />
            {view === "checkout" ? "Checkout" : view === "done" ? "Order placed" : "Your bag"}
          </h2>
          <button
            onClick={handleClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {view === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-400" />
            <h3 className="text-xl font-semibold">Merci!</h3>
            <p className="text-sm text-white/60">
              Your order is confirmed. A receipt is on its way to your inbox.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-neutral-900"
            >
              Keep browsing
            </button>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-white/50">
            <ShoppingBag className="h-10 w-10 text-white/20" />
            <p className="font-medium text-white/80">Your bag is empty</p>
            <p className="text-sm">Try something on to get started.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {lines.map((line) => (
                <div
                  key={`${line.garment.id}-${line.size}`}
                  className="flex gap-3 rounded-2xl border border-white/10 p-3"
                >
                  <span
                    className="h-20 w-16 shrink-0 overflow-hidden rounded-lg"
                    style={{
                      background: `linear-gradient(160deg, ${line.garment.accent[0]}, ${line.garment.accent[1]})`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.garment.image}
                      alt={line.garment.name}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium leading-tight">
                          {line.garment.name}
                        </p>
                        <p className="text-xs text-white/40">
                          {line.garment.brand} · Size {line.size}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(line.garment.id, line.size)}
                        className="text-white/30 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full border border-white/15">
                        <button
                          onClick={() => setQty(line.garment.id, line.size, line.qty - 1)}
                          className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-medium">{line.qty}</span>
                        <button
                          onClick={() => setQty(line.garment.id, line.size, line.qty + 1)}
                          className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">
                        ${line.garment.price * line.qty}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {view === "checkout" && (
                <div className="space-y-3 rounded-2xl border border-white/10 p-4">
                  <p className="text-sm font-semibold">Shipping details</p>
                  <Field label="Full name" placeholder="Alex Morgan" />
                  <Field label="Email" placeholder="alex@email.com" type="email" />
                  <Field label="Address" placeholder="1 Rue de la Mode" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City" placeholder="Paris" />
                    <Field label="ZIP" placeholder="75001" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <Lock className="h-3.5 w-3.5" /> Demo checkout — no real payment.
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-white/10 p-5">
              <div className="space-y-1 text-sm">
                <Row label="Subtotal" value={`$${subtotal}`} />
                <Row label="Shipping" value={shipping === 0 ? "Free" : `$${shipping}`} />
                <div className="flex items-center justify-between pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span>${total}</span>
                </div>
              </div>
              {view === "cart" ? (
                <button
                  onClick={() => setView("checkout")}
                  className="w-full rounded-full bg-white py-3 font-medium text-neutral-900 transition hover:bg-white/90"
                >
                  Checkout
                </button>
              ) : (
                <button
                  onClick={placeOrder}
                  className="w-full rounded-full bg-white py-3 font-medium text-neutral-900 transition hover:bg-white/90"
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-white/50">
      <span>{label}</span>
      <span className="font-medium text-white/80">{value}</span>
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
      <span className="mb-1 block text-xs font-medium text-white/50">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/40"
      />
    </label>
  );
}
