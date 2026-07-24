"use client";

import { ScanFace, Star } from "lucide-react";
import { useStore } from "@/lib/store";

export function Hero() {
  const openScan = useStore((s) => s.openScan);

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 80% 0%, #ede9fe 0%, transparent 60%), radial-gradient(50% 50% at 0% 100%, #fce7f3 0%, transparent 55%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:py-24 lg:grid-cols-2">
        <div className="animate-float-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-3 py-1 text-xs font-medium text-violet-700">
            <Star className="h-3.5 w-3.5 fill-violet-500 text-violet-500" />
            Clinical AI skin analysis · powered by YouCam
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
            Stop guessing.
            <br />
            Shop for the skin
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              you actually have.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-stone-600">
            One selfie. Eleven dermatological concerns scored in seconds. Then a
            storefront that rearranges itself around your real skin — not a
            generic skin type.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={openScan}
              className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 font-medium text-white transition hover:bg-stone-700"
            >
              <ScanFace className="h-5 w-5" />
              Scan my skin — free
            </button>
            <a
              href="#shop"
              className="rounded-full border border-stone-300 px-6 py-3.5 font-medium text-stone-700 transition hover:bg-white"
            >
              Browse the shelf
            </a>
          </div>
          <p className="mt-4 text-xs text-stone-400">
            Your photo is analyzed on demand and never stored.
          </p>
        </div>

        {/* Visual */}
        <div className="relative hidden lg:block">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] border border-white bg-white shadow-xl">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(160deg, #f5f3ff 0%, #fdf2f8 60%, #ffffff 100%)",
              }}
            />
            <div className="relative flex h-full flex-col items-center justify-center gap-5 p-8">
              <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-6xl shadow-inner">
                🧑🏻
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
