"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Camera, Shirt, ShoppingBag, ScanFace, ArrowRight } from "lucide-react";
import { GARMENTS, GARMENT_CATEGORIES } from "@/lib/fashion/products";
import { GarmentCard } from "@/components/fashion/GarmentCard";
import { useFashion } from "@/lib/fashion/store";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import {
  deriveStyleProfile,
  rankGarmentsForSkin,
  type StyledGarment,
} from "@/lib/fashion/styling";

export default function FashionHome() {
  const [cat, setCat] = useState<string>("All");
  const openTryOn = useFashion((s) => s.openTryOn);
  const openProof = useFashion((s) => s.openProof);
  const profile = useStore((s) => s.profile);
  const hydrated = useHydrated();

  const skin = hydrated ? profile : null;

  // Skin-informed styling: derive the recommendation + per-garment verdicts.
  const styleProfile = useMemo(
    () => (skin ? deriveStyleProfile(skin) : null),
    [skin],
  );
  const styledMap = useMemo(() => {
    if (!skin) return null;
    const map = new Map<string, StyledGarment>();
    for (const sg of rankGarmentsForSkin(skin, GARMENTS)) map.set(sg.garment.id, sg);
    return map;
  }, [skin]);

  const filtered = useMemo(() => {
    const base =
      cat === "All" ? GARMENTS : GARMENTS.filter((g) => g.category === cat);
    if (!styledMap) return base;
    // When we have a skin profile, float the most-flattering pieces to the top.
    return [...base].sort(
      (a, b) =>
        (styledMap.get(b.id)?.score ?? 0) - (styledMap.get(a.id)?.score ?? 0),
    );
  }, [cat, styledMap]);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(50% 60% at 75% 0%, #3b0764 0%, transparent 60%), radial-gradient(40% 50% at 0% 100%, #1e1b4b 0%, transparent 55%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:py-28">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
            <Sparkles className="h-3.5 w-3.5" />
            Photorealistic AI try-on · powered by YouCam
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Wear it before
            <br />
            you buy it.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/60">
            Upload one photo and see our collection on <em>you</em> — not a
            model. The fitting room that never closes.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <a
              href="#shop"
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-medium text-neutral-900 transition hover:bg-white/90"
            >
              <Shirt className="h-5 w-5" /> Browse the collection
            </a>
            <button
              onClick={() => openTryOn(GARMENTS[0].id)}
              className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 font-medium text-white transition hover:bg-white/10"
            >
              <Camera className="h-5 w-5" /> Try one on
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: Camera, title: "1 · Add your photo", body: "One clear, front-facing photo of your upper or full body is all it takes." },
              { icon: Sparkles, title: "2 · Try it on", body: "Perfect Corp's AI dresses you in the garment — photorealistic, in seconds." },
              { icon: ShoppingBag, title: "3 · Shop the fit", body: "Love it? Pick your size and add it straight to your bag." },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border border-white/10 p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-white/50">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop */}
      <section id="shop" className="mx-auto max-w-6xl px-5 py-14">
        {/* Skin-informed styling banner — the bridge between the two APIs. */}
        {styleProfile ? (
          <div className="mb-8 overflow-hidden rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-600/15 via-violet-600/10 to-transparent p-6 sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-200/80">
              <ScanFace className="h-4 w-4" /> Styled for your skin
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              {styleProfile.headline}
            </h2>
            <ul className="mt-3 space-y-1.5">
              {styleProfile.rationale.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/70">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>

            {/* Your palette swatches (present when a real tone was analysed). */}
            {styleProfile.palette.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-white/40">
                  Your colours
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {styleProfile.palette.map((c) => (
                    <div key={c.hex} className="flex items-center gap-1.5">
                      <span
                        className="h-6 w-6 rounded-full border border-white/20"
                        style={{ background: c.hex }}
                        title={c.name}
                      />
                      <span className="text-xs capitalize text-white/50">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-white/40">
              {styleProfile.hasTone
                ? `Based on your measured skin tone · ${styleProfile.seasonLabel} · ${styleProfile.undertone} undertone. A styling suggestion, not medical advice.`
                : "Based on your Perfect Corp skin scan. A styling suggestion, not medical advice."}
            </p>

            {styleProfile.hasTone && (
              <button
                onClick={openProof}
                className="mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-white/90"
              >
                <Sparkles className="h-4 w-4" /> Prove it on your photo
              </button>
            )}
          </div>
        ) : (
          <Link
            href="/#scan"
            className="group mb-8 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05] sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-300">
                <ScanFace className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-semibold">Personalize these picks</h2>
                <p className="text-sm text-white/50">
                  Scan your skin and we&apos;ll surface the colours that flatter your
                  complexion — cool tones that calm redness, shades that lift your glow.
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition group-hover:gap-3">
              Scan my skin <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">The Collection</h2>
            <p className="mt-1 text-sm text-white/50">
              {styledMap
                ? "Ordered by what flatters your skin. Tap any piece to see it on your photo."
                : "Tap any piece to see it on your photo."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {GARMENT_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  cat === c
                    ? "bg-white text-neutral-900"
                    : "border border-white/15 text-white/60 hover:bg-white/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((g) => (
            <GarmentCard
              key={g.id}
              garment={g}
              styled={styledMap?.get(g.id) ?? null}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
