"use client";

import type { Garment } from "@/lib/fashion/products";
import type { ColourwayState } from "@/lib/fashion/useColourway";

/** Swatch row for a garment's colourways, each marked with its verdict. */
export function ColourwayPicker({
  garment,
  state,
}: {
  garment: Garment;
  state: ColourwayState;
}) {
  const { ranking, colourway, verdict, isOurPick, select } = state;
  if (garment.colourways.length < 2) return null;
  const verdictOf = (id: string) => ranking.find((r) => r.colourway.id === id)?.verdict;

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colour">
        {garment.colourways.map((c) => {
          const v = verdictOf(c.id);
          const active = c.id === colourway.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              title={c.name}
              onClick={() => select(c.id)}
              className={`relative h-6 w-6 rounded-full border transition ${
                active
                  ? "scale-110 border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                  : "border-white/25 hover:border-white/60"
              }`}
              style={{ background: c.hex }}
            >
              {(v === "best" || v === "good" || v === "clash") && (
                <span
                  className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-neutral-900 ${
                    v === "clash" ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] capitalize text-white/50">
        {colourway.name}
        {colourway.original ? " · as pictured" : ""}
        {isOurPick && verdict?.verdict === "best" ? " · our pick for you" : ""}
      </p>
    </div>
  );
}
