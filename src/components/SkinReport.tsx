"use client";

import Link from "next/link";
import {
  RotateCcw,
  FlaskConical,
  Sparkles,
  Shirt,
  ArrowRight,
  Palette,
  BadgeDollarSign,
} from "lucide-react";
import {
  ALL_CONCERNS,
  CONCERN_META,
  rankedConcerns,
  severityFor,
  SEVERITY_META,
  type SkinProfile,
} from "@/lib/skin";
import { UNDERTONE_LABEL, DEPTH_LABEL } from "@/lib/color";
import { heroPick, bestValuePick } from "@/lib/matching";
import { deriveStyleProfile } from "@/lib/fashion/styling";
import { ConcernGauge } from "@/components/ConcernGauge";
import { ProductImage } from "@/components/ProductImage";
import { RoutineSection } from "@/components/RoutineSection";
import { ProgressSection } from "@/components/ProgressSection";
import { useStore } from "@/lib/store";

export function SkinReport({ profile }: { profile: SkinProfile }) {
  const openScan = useStore((s) => s.openScan);
  const addToCart = useStore((s) => s.addProduct);
  const previousProfile = useStore((s) => s.previousProfile);
  const focus = rankedConcerns(profile).slice(0, 3);
  const hero = heroPick(profile);
  const value = bestValuePick(profile);
  const style = deriveStyleProfile(profile);

  return (
    <section id="report" className="animate-float-in scroll-mt-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-3xl font-medium tracking-tight text-stone-900">
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

        {/* Personal colour analysis — the bridge to the fitting room. */}
        {profile.tone && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
              <Palette className="h-4 w-4 text-[#b5451f]" /> Your colour season
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span
                className="h-14 w-14 shrink-0 rounded-2xl border border-stone-200 shadow-inner"
                style={{ background: profile.tone.hex }}
                title={`Measured skin tone ${profile.tone.hex}`}
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h4 className="text-xl font-semibold text-stone-900">
                    {profile.tone.seasonLabel}
                  </h4>
                  <span className="text-sm text-stone-500">
                    {UNDERTONE_LABEL[profile.tone.undertone]} undertone ·{" "}
                    {DEPTH_LABEL[profile.tone.depth]} · ITA° {profile.tone.ita}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-stone-600">
                  {profile.tone.description}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Colours made for you
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                {profile.tone.palette.map((c) => (
                  <div key={c.hex} className="flex flex-col items-center gap-1">
                    <span
                      className="h-9 w-9 rounded-full border border-stone-200"
                      style={{ background: c.hex }}
                      title={c.name}
                    />
                    <span className="text-[10px] capitalize text-stone-500">
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {profile.tone.lowConfidence && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Lower confidence — your lighting looked uneven or your face
                didn&apos;t fill the frame. Rescan in brighter, even light for a
                sharper colour read.
              </p>
            )}

            {profile.tone.analysis && (
              <ConfidenceBar analysis={profile.tone.analysis} />
            )}

            {/* Why this season — the explainable science. */}
            <details className="mt-3 rounded-lg border border-stone-200 bg-white/60 px-3 py-2 text-xs text-stone-600">
              <summary className="cursor-pointer font-medium text-stone-700">
                Why {profile.tone.seasonLabel}? See the math
              </summary>
              <div className="mt-2 space-y-1 text-stone-500">
                <p>
                  Measured skin colour{" "}
                  <span
                    className="inline-block h-3 w-3 translate-y-0.5 rounded-sm border border-stone-300"
                    style={{ background: profile.tone.hex }}
                  />{" "}
                  <code className="text-stone-600">{profile.tone.hex}</code> →
                  CIELAB (L* {profile.tone.lab.L.toFixed(0)}, a*{" "}
                  {profile.tone.lab.a.toFixed(1)}, b* {profile.tone.lab.b.toFixed(1)}).
                </p>
                <p>
                  <strong>ITA° {profile.tone.ita}</strong> → {DEPTH_LABEL[profile.tone.depth].toLowerCase()} depth.
                  b*−a* gap → <strong>{UNDERTONE_LABEL[profile.tone.undertone].toLowerCase()}</strong> undertone.
                  Chroma {profile.tone.chroma} → clarity.
                </p>

                {profile.tone.analysis ? (
                  <>
                    <p className="pt-1">
                      Season is decided on three axes — <em>hue</em>,{" "}
                      <em>value</em> and <em>chroma</em> — and named for
                      whichever dominates:
                    </p>
                    <ul className="ml-1 space-y-0.5">
                      {profile.tone.analysis.reasoning.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>
                    Undertone + depth + clarity map onto the 12-season system →{" "}
                    <strong>{profile.tone.seasonLabel}</strong>.
                  </p>
                )}
              </div>
            </details>
            <p className="mt-3 text-[11px] text-stone-400">
              Skin tone measured from your photo (CIELAB · ITA°). Try these
              colours on in the fitting room below.
            </p>
          </div>
        )}

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
                  <FlaskConical className="h-3.5 w-3.5 text-[#b5451f]" />
                  <span className="font-medium">Look for:</span>
                  {meta.lookFor.slice(0, 2).join(", ")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hero recommendation */}
        {hero && (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-br from-[#b5451f] to-[#d9a679] p-5 text-white sm:flex-row sm:items-center">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <ProductImage product={hero.product} className="h-12 w-auto" />
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
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#93381a] transition hover:bg-white/90"
              >
                Add to bag
              </button>
            </div>
          </div>
        )}

        {/* Best value for the #1 concern — the cheap workhorse, not just the
            priciest formula. */}
        {value && hero && value.product.id !== hero.product.id && (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${value.product.accent[0]}22, ${value.product.accent[1]}33)`,
              }}
            >
              <ProductImage product={value.product} className="h-9 w-auto" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                <BadgeDollarSign className="h-3.5 w-3.5" /> Best value for your
                top concern
              </p>
              <p className="mt-0.5 font-semibold text-stone-900">
                {value.product.name}
              </p>
              <p className="text-sm text-stone-500">{value.reason}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-stone-900">
                ${value.product.price}
              </span>
              <button
                onClick={() => addToCart(value.product)}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Add to bag
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Your routine — the "what do I actually do" step. */}
      <div className="mt-4">
        <RoutineSection profile={profile} />
      </div>

      {/* Progress vs. the previous scan + rescan cadence. */}
      <div className="mt-4">
        <ProgressSection profile={profile} previous={previousProfile} />
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
            <p className="text-xs font-medium uppercase tracking-wide text-[#d9a679]">
              Now style it · {style.headline}
            </p>
            <h3 className="mt-0.5 text-xl font-semibold">
              See the fitting room, styled to your skin
            </h3>
            <p className="text-sm text-white/70">
              {style.hasTone
                ? `Your skin tone reads ${style.undertone} (${style.seasonLabel}) — we've ordered the collection to your palette so you can try your best colours on your own photo.`
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

/** Confidence and completeness of the season call. Deliberately prominent:
 *  a skin-only reading is a weaker claim and the user should see that. */
function ConfidenceBar({
  analysis,
}: {
  analysis: NonNullable<import("@/lib/color").SkinTone["analysis"]>;
}) {
  const pct = Math.round(analysis.confidence * 100);
  const missing = [
    !analysis.inputs.hair ? "hair" : null,
    !analysis.inputs.eye ? "eye" : null,
  ].filter(Boolean);
  const strong = analysis.confidence >= 0.75;

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-white/60 px-3 py-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-stone-600">
          Confidence in this season
        </span>
        <span
          className={`font-semibold ${strong ? "text-emerald-600" : "text-amber-600"}`}
        >
          {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full ${strong ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
        Decided on your <strong>{analysis.dominant}</strong> axis, from{" "}
        {analysis.inputs.hair && analysis.inputs.eye
          ? "skin, hair and eye colour"
          : analysis.inputs.hair
            ? "skin and hair colour"
            : analysis.inputs.eye
              ? "skin and eye colour"
              : "skin colour alone"}
        .
        {missing.length > 0 && (
          <>
            {" "}
            Add your {missing.join(" and ")} colour on your next scan for a
            firmer read.
          </>
        )}
      </p>
    </div>
  );
}
