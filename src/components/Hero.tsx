"use client";

import { ScanFace, Sparkles, ShieldCheck, Palette } from "lucide-react";
import { useStore } from "@/lib/store";
import { seasonDef } from "@/lib/color";

/** The four gauges in the preview card. Values are illustrative, not measured -
 *  the card is marked as a sample so it cannot be mistaken for a real result.
 *  Hues are distinct enough to read as separate metrics while staying out of
 *  the cool end of the wheel, which fought the warm page. */
const SAMPLE = [
  { label: "Hydration", value: 58, color: "#2f8fb3" },
  { label: "Redness", value: 62, color: "#c2453f" },
  { label: "Radiance", value: 71, color: "#e0a02c" },
  { label: "Pores", value: 66, color: "#7c6a46" },
] as const;

/** The real True Autumn palette from the engine, not a hand-picked array - so
 *  the hero shows exactly what a real result would show. */
const SAMPLE_SEASON = seasonDef("true-autumn");

export function Hero() {
  const openScan = useStore((s) => s.openScan);

  return (
    <section className="relative overflow-hidden">
      {/* Ambient colour fields. Two large, heavily blurred blobs drifting on
          long cycles - enough to make the page feel alive without competing
          with the type. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="animate-drift absolute -right-32 -top-40 h-[38rem] w-[38rem] rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, #f0dcc2 0%, #efe7d6 45%, transparent 70%)",
          }}
        />
        <div
          className="animate-drift absolute -bottom-56 -left-40 h-[34rem] w-[34rem] rounded-full opacity-60 blur-3xl"
          style={{
            animationDelay: "-8s",
            background:
              "radial-gradient(circle, #e7d3c6 0%, #ece3d2 50%, transparent 72%)",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ---------------------------------------------------------------- */}
        <div>
          <div
            className="animate-rise inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white/60 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.15em] text-stone-600 backdrop-blur"
            style={{ "--delay": "0ms" } as React.CSSProperties}
          >
            <span className="animate-pulse-ring h-1.5 w-1.5 rounded-full bg-[#b5451f]" />
            Powered by YouCam AI
          </div>

          <h1
            className="animate-rise display mt-6 font-serif text-[3.25rem] font-medium text-stone-900 sm:text-7xl"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            Shop for the skin
            <br />
            you <em className="text-gradient italic">actually</em> have.
          </h1>

          <p
            className="animate-rise mt-7 max-w-md text-lg leading-relaxed text-stone-600"
            style={{ "--delay": "160ms" } as React.CSSProperties}
          >
            One selfie. Eleven dermatological concerns scored in seconds — and
            your colour season read from the same photo. Then a storefront that
            rearranges itself around your real skin.
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center gap-3"
            style={{ "--delay": "240ms" } as React.CSSProperties}
          >
            <button
              onClick={openScan}
              className="sheen-host group flex items-center gap-2.5 rounded-full bg-stone-900 px-7 py-4 font-medium text-white shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:bg-stone-800 active:translate-y-0"
            >
              <ScanFace className="h-5 w-5 transition-transform duration-300 group-hover:rotate-6" />
              Scan my skin — free
            </button>
            <a
              href="#shop"
              className="rounded-full border border-stone-300 bg-white/40 px-7 py-4 font-medium text-stone-700 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-stone-400 hover:bg-white/70"
            >
              Browse the shelf
            </a>
          </div>

          {/* Trust row. Three concrete promises beat one line of small print. */}
          <div
            className="animate-rise mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-stone-500"
            style={{ "--delay": "320ms" } as React.CSSProperties}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#b5451f]" /> Free · 20 seconds
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#b5451f]" /> Photo discarded
              after analysis
            </span>
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-[#b5451f]" /> 12-season colour
              analysis
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Preview card */}
        <div
          className="animate-rise relative hidden lg:block"
          style={{ "--delay": "180ms" } as React.CSSProperties}
        >
          <div className="border-gradient shadow-lift relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] bg-white">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(160deg, #f8f4ec 0%, #efe7d6 55%, #ffffff 100%)",
              }}
            />

            <div className="relative flex h-full flex-col items-center justify-center gap-5 p-8">
              <div className="relative">
                <div className="animate-pulse-ring grid h-24 w-24 place-items-center rounded-full bg-white text-[#b5451f] shadow-soft">
                  <ScanFace className="h-11 w-11" strokeWidth={1.5} />
                </div>
              </div>

              <div className="w-full space-y-3">
                {SAMPLE.map((row, i) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-[4.5rem] text-xs font-medium text-stone-500">
                      {row.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200/70">
                      <div
                        className="animate-grow-x h-full rounded-full"
                        style={
                          {
                            width: `${row.value}%`,
                            background: row.color,
                            "--delay": `${300 + i * 80}ms`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <span className="w-7 text-right text-xs font-semibold tabular-nums text-stone-700">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Colour season strip - the differentiator, shown not told. */}
              <div className="glass w-full rounded-2xl p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-stone-500">
                  Your colour season
                </p>
                <p className="mt-0.5 font-serif text-lg font-medium text-stone-900">
                  {SAMPLE_SEASON.label}
                </p>
                <div className="mt-2 flex gap-1.5">
                  {SAMPLE_SEASON.palette.map((c, i) => (
                    <span
                      key={c.hex}
                      title={c.name}
                      className="animate-rise h-5 flex-1 rounded-full ring-1 ring-black/5"
                      style={
                        {
                          background: c.hex,
                          "--delay": `${560 + i * 50}ms`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <span className="absolute right-3 top-3 rounded-full bg-stone-900/75 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
              Sample
            </span>
          </div>

          {/* Floating match chip, overlapping the card edge for depth. */}
          <div
            className="glass animate-rise absolute -bottom-5 -left-4 rounded-2xl px-4 py-3"
            style={{ "--delay": "540ms" } as React.CSSProperties}
          >
            <p className="text-[11px] text-stone-500">Top match for you</p>
            <p className="text-sm font-semibold text-stone-900">
              Hydra-Plump HA Serum{" "}
              <span className="text-[#b5451f]">94%</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
