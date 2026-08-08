"use client";

import { Plus, Check, Star } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/products";
import type { MatchResult } from "@/lib/matching";
import { useStore } from "@/lib/store";
import { ProductImage } from "@/components/ProductImage";

interface Props {
  product: Product;
  match?: MatchResult;
  rank?: number;
}

export function ProductCard({ product, match, rank }: Props) {
  const addToCart = useStore((s) => s.addProduct);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  const showMatch = match && match.score >= 45 && match.addresses.length > 0;
  const isTop = showMatch && rank === 0;

  return (
    <div
      className={`card-lift group flex flex-col overflow-hidden rounded-2xl border bg-white ${
        isTop ? "border-[#b5451f]/40 shadow-soft" : "border-stone-200"
      }`}
    >
      <div
        className="sheen-host relative flex h-44 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${product.accent[0]}22, ${product.accent[1]}33)`,
        }}
      >
        <ProductImage
          product={product}
          className="h-32 w-auto drop-shadow-sm transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.06]"
        />

        {showMatch &&
          (isTop ? (
            /* The single best pick earns a solid, saturated badge. Everything
               else stays quiet so this one actually reads as "first". */
            <div className="shadow-glow absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#b5451f] px-2.5 py-1 text-xs font-semibold text-white">
              <Star className="h-3 w-3 fill-current" /> Top match
            </div>
          ) : (
            <div className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-[#93381a] shadow-sm backdrop-blur">
              {match!.score}% match
            </div>
          ))}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
          {product.brand} · {product.category}
        </p>
        <h3 className="mt-1 font-semibold leading-tight text-stone-900">
          {product.name}
        </h3>

        {showMatch ? (
          <>
            <p className="mt-1.5 text-sm font-medium text-[#93381a]">
              {match!.reason}
            </p>
            {/* Evidence: the user's own scores behind this recommendation. */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match!.evidence.slice(0, 3).map((e) => (
                <span
                  key={e.key}
                  className="rounded-md bg-[#b5451f]/8 px-2 py-0.5 text-[11px] font-medium text-[#93381a] ring-1 ring-[#b5451f]/15"
                  title={`Your ${e.label.toLowerCase()} score is ${e.score}/100 — lower means more support needed.`}
                >
                  Your {e.label.toLowerCase()}: {e.score}
                </span>
              ))}
            </div>
          </>
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
          <span className="font-serif text-xl font-medium tabular-nums text-stone-900">
            ${product.price}
          </span>
          <button
            onClick={handleAdd}
            aria-label={`Add ${product.name} to bag`}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
              added
                ? "bg-emerald-500"
                : "bg-stone-900 hover:bg-stone-800 hover:shadow-glow"
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
