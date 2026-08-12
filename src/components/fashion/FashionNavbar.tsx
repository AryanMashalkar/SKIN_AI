"use client";

import Link from "next/link";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { cartCount, useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

export function FashionNavbar() {
  const cart = useStore((s) => s.cart);
  const openCart = useStore((s) => s.openCart);
  const hydrated = useHydrated();
  const count = hydrated ? cartCount(cart) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-5">
          {/* Back to the skincare half. Was hidden below sm, which stranded
              phone users in the fitting room with no route out. */}
          <Link
            href="/"
            aria-label="Back to skincare"
            className="flex items-center gap-1.5 text-xs font-medium text-white/50 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Skincare</span>
          </Link>
          <Link href="/fashion" className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-[0.2em] text-white">
              MIROIR
            </span>
            <span className="hidden text-[10px] uppercase tracking-widest text-white/40 sm:inline">
              Fitting Room
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-7 text-sm font-medium text-white/60 md:flex">
          <a href="#shop" className="hover:text-white">Collection</a>
          <a href="#how" className="hover:text-white">How it works</a>
        </nav>

        <button
          onClick={openCart}
          aria-label="Open cart"
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10"
        >
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-semibold text-neutral-900">
              {count}
            </span>
          )}
        </button>
      </div>

      {/* Mobile navigation row, mirroring the skincare header. */}
      <nav className="flex items-center gap-6 overflow-x-auto border-t border-white/10 px-5 py-2.5 text-sm font-medium text-white/60 md:hidden">
        <a href="#shop" className="whitespace-nowrap hover:text-white">Collection</a>
        <a href="#how" className="whitespace-nowrap hover:text-white">How it works</a>
        <Link href="/" className="whitespace-nowrap hover:text-white">Skincare</Link>
      </nav>
    </header>
  );
}
