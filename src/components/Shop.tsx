"use client";

import { useMemo, useState } from "react";
import { ScanFace } from "lucide-react";
import { CATEGORIES, PRODUCTS, type Category } from "@/lib/products";
import { rankProducts, type MatchResult } from "@/lib/matching";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { ProductCard } from "@/components/ProductCard";
import { SkinReport } from "@/components/SkinReport";

export function Shop() {
  const profile = useStore((s) => s.profile);
  const openScan = useStore((s) => s.openScan);
  const hydrated = useHydrated();
  const [cat, setCat] = useState<Category | "All">("All");

  const activeProfile = hydrated ? profile : null;

  // Ordered list of { product, match } — ranked by match when we have a profile.
  const ordered = useMemo(() => {
    if (activeProfile) {
      return rankProducts(activeProfile).map((m) => ({
        product: m.product,
        match: m as MatchResult,
      }));
    }
    return PRODUCTS.map((product) => ({ product, match: undefined }));
  }, [activeProfile]);

  const filtered = ordered.filter(
    (o) => cat === "All" || o.product.category === cat,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-5 py-14">
      {activeProfile && <SkinReport profile={activeProfile} />}

      {!activeProfile && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-[#e9d9be] bg-[#faf5ee]/40 p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f4ead9] text-[#b5451f]">
            <ScanFace className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">
              Personalize this shelf
            </h3>
            <p className="mt-1 max-w-md text-sm text-stone-500">
              Right now you&apos;re browsing our full catalog. Scan your skin and
              every product below reorders and scores itself against your
              concerns.
            </p>
          </div>
          <button
            onClick={openScan}
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            Scan my skin
          </button>
        </div>
      )}

      {/* Shop header + filters */}
      <div id="shop" className="scroll-mt-20">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            {/* Eyebrow + rule. A label above the heading and a short accent
                rule under it give the section a masthead rather than a
                paragraph of bold text. */}
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b5451f]">
              <span className="h-px w-6 bg-[#b5451f]/50" />
              {activeProfile ? "Personalised" : "Catalogue"}
            </p>
            <h2 className="display mt-2 font-serif text-4xl font-medium text-stone-900 sm:text-5xl">
              {activeProfile ? "Matched to your skin" : "The shelf"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-stone-500">
              {activeProfile
                ? "Sorted by how well each formula fits your results."
                : "A demo shelf covering every concern we score."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={cat === "All"}
              onClick={() => setCat("All")}
              label="All"
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={cat === c}
                onClick={() => setCat(c)}
                label={c}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o, i) => (
            // Cascade the grid in rather than popping it all at once. Capped
            // so a long list does not leave the last cards waiting.
            <div
              key={o.product.id}
              className="animate-rise"
              style={{ "--delay": `${Math.min(i, 8) * 55}ms` } as React.CSSProperties}
            >
              <ProductCard
                product={o.product}
                match={o.match}
                rank={cat === "All" ? i : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ${
        active
          ? "bg-stone-900 text-white shadow-soft"
          : "border border-stone-200 bg-white/50 text-stone-600 backdrop-blur hover:-translate-y-0.5 hover:border-[#d9a679] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
