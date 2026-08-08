"use client";

import { useState } from "react";
import { Sun, Moon, ShoppingBag, Check, Info } from "lucide-react";
import type { SkinProfile } from "@/lib/skin";
import {
  buildRoutine,
  routineProducts,
  type RoutineStep,
  type RoutineTier,
} from "@/lib/matching";
import { ProductImage } from "@/components/ProductImage";
import { useStore } from "@/lib/store";

export function RoutineSection({ profile }: { profile: SkinProfile }) {
  const addToCart = useStore((s) => s.addProduct);
  const [tier, setTier] = useState<RoutineTier>("complete");
  const [added, setAdded] = useState(false);

  const routine = buildRoutine(profile, tier);
  const products = routineProducts(routine);

  function addAll() {
    products.forEach((p) => addToCart(p, 1));
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl font-medium tracking-tight text-stone-900">
            Your routine
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Built from your results and ordered correctly — thin to thick, SPF
            last in the morning.
          </p>
        </div>

        {/* Budget / depth toggle */}
        <div
          className="flex rounded-full border border-stone-200 p-1"
          role="group"
          aria-label="Routine depth"
        >
          {(["starter", "complete"] as RoutineTier[]).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              aria-pressed={tier === t}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                tier === t
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <RoutineColumn
          icon={<Sun className="h-4 w-4" />}
          title="Morning"
          steps={routine.am}
        />
        <RoutineColumn
          icon={<Moon className="h-4 w-4" />}
          title="Night"
          steps={routine.pm}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
        <div>
          <p className="text-sm text-stone-500">
            {products.length} products ·{" "}
            <span className="font-semibold text-stone-900">
              ${routine.total}
            </span>
          </p>
          {tier === "complete" && (
            <button
              onClick={() => setTier("starter")}
              className="mt-0.5 text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600"
            >
              Too much? See the starter routine
            </button>
          )}
        </div>
        <button
          onClick={addAll}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition ${
            added ? "bg-emerald-500" : "bg-stone-900 hover:bg-stone-800"
          }`}
        >
          {added ? (
            <>
              <Check className="h-4 w-4" /> Routine added
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" /> Add routine · ${routine.total}
            </>
          )}
        </button>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-stone-400">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Introduce active treatments one at a time, a few nights a week to start.
        Cosmetic guidance only — not medical advice.
      </p>
    </div>
  );
}

function RoutineColumn({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: RoutineStep[];
}) {
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-stone-50/50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-stone-700">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#b5451f] shadow-sm">
          {icon}
        </span>
        {title}
      </div>

      <ol className="mt-3 space-y-2.5">
        {steps.map((step, i) => (
          <li key={`${step.slot}-${step.product.id}`} className="flex gap-3">
            <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600">
              {i + 1}
            </span>
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${step.product.accent[0]}22, ${step.product.accent[1]}33)`,
              }}
            >
              <ProductImage product={step.product} className="h-9 w-auto" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                {step.slot}
              </p>
              <p className="truncate text-sm font-medium text-stone-900">
                {step.product.name}
              </p>
              <p className="text-xs text-stone-500">${step.product.price}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
