"use client";

import Link from "next/link";
import { RotateCcw, FlaskConical, Sparkles, Shirt, ArrowRight } from "lucide-react";
import {
  ALL_CONCERNS,
  CONCERN_META,
  rankedConcerns,
  severityFor,
  SEVERITY_META,
  type SkinProfile,
} from "@/lib/skin";
import { heroPick } from "@/lib/matching";
import { deriveStyleProfile } from "@/lib/fashion/styling";
import { ConcernGauge } from "@/components/ConcernGauge";
import { useStore } from "@/lib/store";

export function SkinReport({ profile }: { profile: SkinProfile }) {
  const openScan = useStore((s) => s.openScan);
  const addToCart = useStore((s) => s.addToCart);
  const focus = rankedConcerns(profile).slice(0, 3);
  const hero = heroPick(profile);
  const style = deriveStyleProfile(profile);

  return (
    <section id="report" className="animate-float-in scroll-mt-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
                Your Skin Report
              </h2>
              {profile.demo && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Demo data
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-stone-500">
              Analyzed {ALL_CONCERNS.length} dermatological concerns · everything
              below is now matched to your skin.
            </p>
          </div>
          <button
            onClick={openScan}
            className="flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            <RotateCcw className="h-4 w-4" /> Rescan
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Skin age" value={`${profile.skinAge}`} suffix="yrs" />
          <Stat label="Skin type" value={profile.skinType} />
          <Stat label="Overall health" value={`${profile.overall}`} suffix="/100" />
          <Stat
            label="Top priority"
            value={CONCERN_META[focus[0]].label}
            tone={SEVERITY_META[severityFor(profile.scores[focus[0]])].text}
          />
        </div>

        {/* Gauges */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
            Concern breakdown
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-y-6 sm:grid-cols-5 lg:grid-cols-6">
            {ALL_CONCERNS.map((key, i) => (
              <ConcernGauge
                key={key}
                score={profile.scores[key]}
                label={CONCERN_META[key].label}
                delay={i * 60}
              />
            ))}
          </div>
        </div>

        {/* Focus areas */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {focus.map((key) => {
            const meta = CONCERN_META[key];
            const sev = severityFor(profile.scores[key]);
            const sm = SEVERITY_META[sev];
            return (
              <div
                key={key}
                className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-900">
                    {meta.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sm.tone}`}
                  >
                    {sm.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">{meta.short}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-600">
                  <FlaskConical className="h-3.5 w-3.5 text-violet-500" />
                  <span className="font-medium">Look for:</span>
                  {meta.lookFor.slice(0, 2).join(", ")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hero recommendation */}
        {hero && (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-white sm:flex-row sm:items-center">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-4xl"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {hero.product.emoji}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
                <Sparkles className="h-3.5 w-3.5" /> Your #1 match ·{" "}
                {hero.score}%
              </div>
              <h4 className="mt-0.5 text-lg font-semibold">
                {hero.product.name}
              </h4>
              <p className="text-sm text-white/85">{hero.reason}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">${hero.product.price}</span>
              <button
                onClick={() => addToCart(hero.product)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-white/90"
              >
                Add to bag
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Skin-informed styling bridge — carries the scan into the fitting room. */}
      <Link
        href="/fashion"
        className="group mt-4 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl border border-stone-800 bg-stone-900 p-6 text-white transition hover:bg-stone-800 sm:flex-row sm:items-center"
      >
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10">
            <Shirt className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fuchsia-300/80">
              Now style it · {style.headline}
            </p>
            <h3 className="mt-0.5 text-xl font-semibold">
              See the fitting room, styled to your skin
            </h3>
            <p className="text-sm text-white/70">
              {style.rednessElevated
                ? `Your redness score (${style.rednessScore}/100) means cooler tones will flatter you — we've ordered the collection to match.`
                : `We'll match garment colours to your complexion and let you try them on your own photo.`}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 transition group-hover:gap-3">
          Open the fitting room <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? "text-stone-900"}`}>
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-stone-400">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
