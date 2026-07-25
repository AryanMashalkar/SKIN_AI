"use client";

import { Sparkles, Check } from "lucide-react";
import type { Garment } from "@/lib/fashion/products";
import type { StyledGarment } from "@/lib/fashion/styling";
import { useFashion } from "@/lib/fashion/store";

export function GarmentCard({
  garment,
  styled = null,
}: {
  garment: Garment;
  styled?: StyledGarment | null;
}) {
  const openTryOn = useFashion((s) => s.openTryOn);
  const result = useFashion((s) => s.results[garment.id]);

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
          src={result || garment.image}
          alt={garment.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        {/* Skin-match badge takes priority over the marketing tag. */}
        {styled?.flatters ? (
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

        {/* Explainable skin-informed reason. */}
        {styled && (
          <p
            className={`mt-1.5 text-xs leading-snug ${
              styled.caution ? "text-amber-300/70" : "text-emerald-300/70"
            }`}
          >
            {styled.reason}
          </p>
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
