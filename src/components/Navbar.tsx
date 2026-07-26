"use client";

import { ShoppingBag, Sparkles, ScanFace } from "lucide-react";
import { cartCount, useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

export function Navbar() {
  const cart = useStore((s) => s.cart);
  const openCart = useStore((s) => s.openCart);
  const openScan = useStore((s) => s.openScan);
  const hydrated = useHydrated();
  const count = hydrated ? cartCount(cart) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/50 bg-[#f4f0e6]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-900 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl font-medium tracking-tight text-stone-900">
            Derma
          </span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
          <a href="#shop" className="hover:text-stone-900">Shop</a>
          <a href="#how" className="hover:text-stone-900">How it works</a>
          <a href="#report" className="hover:text-stone-900">Your skin</a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={openScan}
            className="hidden items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 sm:flex"
          >
            <ScanFace className="h-4 w-4" />
            Scan my skin
          </button>
          <button
            onClick={openCart}
            aria-label="Open cart"
            className="relative grid h-10 w-10 place-items-center rounded-full border border-stone-300 text-stone-700 transition hover:bg-white/60"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-stone-900 px-1 text-[11px] font-semibold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
