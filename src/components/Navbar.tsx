"use client";

import Link from "next/link";
import { ShoppingBag, Sparkles, ScanFace } from "lucide-react";
import { cartCount, useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

export function Navbar() {
  const cart = useStore((s) => s.cart);
  const openCart = useStore((s) => s.openCart);
  const openScan = useStore((s) => s.openScan);
  const profile = useStore((s) => s.profile);
  const hydrated = useHydrated();
  const hasProfile = hydrated && !!profile;
  const count = hydrated ? cartCount(cart) : 0;

  const links = (
    <>
      <a href="#shop" className="whitespace-nowrap hover:text-stone-900">
        Skincare
      </a>
      <Link href="/fashion" className="whitespace-nowrap hover:text-stone-900">
        Fitting room
      </Link>
      {/* #report only exists once a scan has produced a profile, so before
          that this link went nowhere. Send the user to the thing that
          creates it instead of silently doing nothing. */}
      {hasProfile ? (
        <a href="#report" className="whitespace-nowrap hover:text-stone-900">
          Your colours
        </a>
      ) : (
        <button onClick={openScan} className="whitespace-nowrap hover:text-stone-900">
          Your colours
        </button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/50 bg-[#f4f0e6]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-900 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl font-medium tracking-tight text-stone-900">
            MIROIR
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
          {links}
        </nav>

        <div className="flex items-center gap-2">
          {/* The primary CTA was hidden below sm, which left a phone with just a
              logo and a cart. It is now always present, collapsing to an icon
              on the narrowest screens rather than disappearing. */}
          <button
            onClick={openScan}
            aria-label="Scan my skin"
            className="flex items-center gap-2 rounded-full bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800 sm:px-4"
          >
            <ScanFace className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Scan my skin</span>
          </button>
          <button
            onClick={openCart}
            aria-label="Open cart"
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-stone-300 text-stone-700 transition hover:bg-white/60"
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

      {/* Mobile navigation. A second row keeps the links reachable without a
          hamburger, which would add state and a focus trap for three links. */}
      <nav className="flex items-center gap-6 overflow-x-auto border-t border-stone-300/40 px-5 py-2.5 text-sm font-medium text-stone-600 md:hidden">
        {links}
      </nav>
    </header>
  );
}
