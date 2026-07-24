"use client";

import { Plus, Check } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/products";
import type { MatchResult } from "@/lib/matching";
import { useStore } from "@/lib/store";

interface Props {
  product: Product;
  match?: MatchResult;
  rank?: number;
}

export function ProductCard({ product, match, rank }: Props) {
  const addToCart = useStore((s) => s.addToCart);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  const showMatch = match && match.score >= 45 && match.addresses.length > 0;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:shadow-lg hover:shadow-stone-200/60">
      <div
        className="relative flex h-40 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${product.accent[0]}22, ${product.accent[1]}33)`,
        }}
      >
        <span className="text-5xl drop-shadow-sm">{product.emoji}</span>
        {showMatch && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur">
            {rank === 0 ? "★ Top match" : `${match!.score}% match`}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
          {product.brand} · {product.category}
        </p>
        <h3 className="mt-1 font-semibold leading-tight text-stone-900">
          {product.name}
        </h3>

        {showMatch ? (
          <p className="mt-1.5 text-sm font-medium text-violet-700">
            {match!.reason}
          </p>
        ) : (
          <p className="mt-1.5 line-clamp-2 text-sm text-stone-500">
            {product.blurb}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1">
          {product.keyIngredients.slice(0, 2).map((ing) => (
            <span
              key={ing}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
            >
              {ing}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-stone-900">
            ${product.price}
          </span>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-white transition ${
              added ? "bg-emerald-500" : "bg-stone-900 hover:bg-stone-700"
            }`}
          >
            {added ? (
              <>
                <Check className="h-4 w-4" /> Added
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
