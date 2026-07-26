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
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-600">
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-medium tracking-tight text-stone-900">
              {activeProfile ? "Matched to your skin" : "The shelf"}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {activeProfile
                ? "Sorted by how well each formula fits your results."
                : "Dermatologist-informed formulas for every concern."}
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

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o, i) => (
            <ProductCard
              key={o.product.id}
              product={o.product}
              match={o.match}
              rank={cat === "All" ? i : undefined}
            />
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
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-stone-900 text-white"
          : "border border-stone-200 text-stone-600 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}
