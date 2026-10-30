"use client";

import { Sparkles, Check, AlertTriangle } from "lucide-react";
import type { Garment } from "@/lib/fashion/products";
import type { StyledGarment } from "@/lib/fashion/styling";
import type { ColourwayVerdict } from "@/lib/fashion/colourways";
import { useFashion, resultKey } from "@/lib/fashion/store";
import { useColourway } from "@/lib/fashion/useColourway";
import { ColourwayPicker } from "@/components/fashion/ColourwayPicker";

const VERDICT_BADGE: Record<ColourwayVerdict, { label: string; className: string } | null> = {
  best: { label: "Best colour for you", className: "bg-emerald-400/90 text-emerald-950" },
  good: { label: "In your palette", className: "bg-emerald-400/90 text-emerald-950" },
  workable: null,
  clash: { label: "Clashes with your palette", className: "bg-amber-400/90 text-amber-950" },
};

export function GarmentCard({
  garment,
  styled = null,
}: {
  garment: Garment;
  styled?: StyledGarment | null;
}) {
  const openTryOn = useFashion((s) => s.openTryOn);
  const state = useColourway(garment);
  const { colourway, verdict, image } = state;
  const result = useFashion((s) => s.results[resultKey(garment.id, colourway.id)]);

  const badge = verdict ? VERDICT_BADGE[verdict.verdict] : null;

  return (
    <div className="group overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
      <button
        onClick={() => openTryOn(garment.id)}
        className="relative block aspect-[3/4] w-full overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${garment.accent[0]}, ${garment.accent[1]})`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result || image || garment.image}
          alt={`${garment.name} in ${colourway.name}`}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
            image || result ? "" : "opacity-40"
          }`}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        {/* Colourway verdict, then the photographed-colour verdict, then the
            marketing tag. */}
        {badge ? (
          <span
            className={`absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${badge.className}`}
          >
            {verdict?.verdict === "clash" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            {badge.label}
          </span>
        ) : !verdict && styled?.flatters ? (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-emerald-400/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-950 backdrop-blur">
            <Check className="h-3 w-3" /> Flatters your skin
          </span>
        ) : garment.tag ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            {garment.tag}
          </span>
        ) : null}
        {result && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-900">
            <Sparkles className="h-3 w-3" /> On you
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-white py-3 text-sm font-medium text-neutral-900 transition group-hover:translate-y-0">
          <Sparkles className="h-4 w-4" /> Try it on with AI
        </span>
      </button>

      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-white/40">
          {garment.brand} · {garment.category}
        </p>
        <h3 className="mt-1 font-medium text-white">{garment.name}</h3>

        <ColourwayPicker garment={garment} state={state} />

        {/* Explainable reason: the colourway's measured verdict when there is
            a palette, otherwise the photographed colour's styling verdict. */}
        {verdict ? (
          <p
            className={`mt-1.5 text-xs leading-snug ${
              verdict.verdict === "clash"
                ? "text-amber-300/70"
                : verdict.verdict === "workable"
                  ? "text-white/50"
                  : "text-emerald-300/70"
            }`}
          >
            {verdict.reason}
          </p>
        ) : (
          styled && (
            <p
              className={`mt-1.5 text-xs leading-snug ${
                styled.caution ? "text-amber-300/70" : "text-emerald-300/70"
              }`}
            >
              {styled.reason}
            </p>
          )
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-semibold text-white">
            ${garment.price}
          </span>
          <button
            onClick={() => openTryOn(garment.id)}
            className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Try on
          </button>
        </div>
      </div>
    </div>
  );
}
