"use client";

import { ScanFace, Sparkles, ShieldCheck, Palette } from "lucide-react";
import { useStore } from "@/lib/store";
import { SAMPLE_PROFILE } from "@/lib/sample-profile";

export function Hero() {
  const openScan = useStore((s) => s.openScan);
  const setProfile = useStore((s) => s.setProfile);

  function loadSample() {
    setProfile(SAMPLE_PROFILE);
    requestAnimationFrame(() => {
      document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

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
            See the colour
            <br />
            that <em className="text-gradient italic">actually</em> suits you.
          </h1>

          <p
            className="animate-rise mt-7 max-w-md text-lg leading-relaxed text-stone-600"
            style={{ "--delay": "160ms" } as React.CSSProperties}
          >
            One selfie. YouCam reads your skin, hair and eyes, MIROIR ranks every
            colour of every garment for you, and you see the difference on your
            own photo before you buy.
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
            <button
              onClick={loadSample}
              className="rounded-full border border-stone-300 bg-white/40 px-7 py-4 font-medium text-stone-700 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-stone-400 hover:bg-white/70"
            >
              See a sample result
            </button>
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
        {/* The proof shot: real try-on output, not an illustration. */}
        <div
          className="animate-rise"
          style={{ "--delay": "180ms" } as React.CSSProperties}
        >
          <div className="grid grid-cols-2 gap-3">
            <figure className="shadow-lift overflow-hidden rounded-2xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/proof/navy.jpg"
                alt="The overshirt in navy, MIROIR's pick, on the author's photo"
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="p-3 text-xs text-stone-600">
                <span className="block font-semibold text-emerald-700">MIROIR&apos;s pick: navy</span>
                Closest palette colour, ΔE 4
              </figcaption>
            </figure>
            <figure className="shadow-lift overflow-hidden rounded-2xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/proof/taupe.jpg"
                alt="The same overshirt in washed taupe, as pictured, on the author's photo"
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="p-3 text-xs text-stone-600">
                <span className="block font-semibold text-amber-700">As pictured: washed taupe</span>
                Nearest palette colour, ΔE 25
              </figcaption>
            </figure>
          </div>
          <p className="mt-3 text-center text-xs text-stone-500">
            Same shirt, same photo. Real YouCam try-ons of the project&apos;s author.
          </p>
        </div>
      </div>
    </section>
  );
}
