"use client";

import { ScanFace } from "lucide-react";
import { useStore } from "@/lib/store";

export function Hero() {
  const openScan = useStore((s) => s.openScan);

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(55% 55% at 82% 0%, #efe7d6 0%, transparent 60%), radial-gradient(45% 50% at 0% 100%, #ece3d2 0%, transparent 55%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:py-24 lg:grid-cols-2">
        <div className="animate-float-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] text-stone-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b5451f]" />
            Powered by YouCam AI
          </div>
          <h1 className="mt-5 font-serif text-5xl font-medium leading-[1.02] tracking-tight text-stone-900 sm:text-6xl">
            Shop for the skin
            <br />
            you <em className="italic text-[#b5451f]">actually</em> have.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone-600">
            One selfie. Eleven dermatological concerns scored in seconds — and
            your colour season read from the same photo. Then a storefront that
            rearranges itself around your real skin.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={openScan}
              className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 font-medium text-white transition hover:bg-stone-800"
            >
              <ScanFace className="h-5 w-5" />
              Scan my skin — free
            </button>
            <a
              href="#shop"
              className="rounded-full border border-stone-300 px-6 py-3.5 font-medium text-stone-700 transition hover:bg-white/60"
            >
              Browse the shelf
            </a>
          </div>
          <p className="mt-4 text-xs text-stone-400">
            Free · takes 20 seconds · your photo is never stored.
          </p>
        </div>

        {/* Visual */}
        <div className="relative hidden lg:block">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-xl">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(160deg, #f6f1e6 0%, #efe7d6 60%, #ffffff 100%)",
              }}
            />
            <div className="relative flex h-full flex-col items-center justify-center gap-5 p-8">
              <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-[#b5451f] shadow-inner">
                <ScanFace className="h-12 w-12" strokeWidth={1.5} />
              </div>
              <div className="w-full space-y-2.5">
                {[
                  ["Hydration", 58, "#0ea5e9"],
                  ["Redness", 62, "#f43f5e"],
                  ["Radiance", 71, "#f59e0b"],
                  ["Pores", 66, "#8b5cf6"],
                ].map(([label, val, color]) => (
                  <div key={label as string} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-medium text-stone-500">
                      {label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${val}%`,
                          background: color as string,
                        }}
                      />
                    </div>
                    <span className="w-7 text-right text-xs font-semibold text-stone-700">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-full rounded-2xl bg-white/80 p-3 text-center shadow-sm backdrop-blur">
                <p className="text-xs text-stone-500">Top match for you</p>
                <p className="text-sm font-semibold text-stone-900">
                  Hydra-Plump HA Serum · 94%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
