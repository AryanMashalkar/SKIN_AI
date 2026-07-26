import { PRODUCTS, type Product } from "@/lib/products";
import {
  ALL_CONCERNS,
  CONCERN_META,
  rankedConcerns,
  type ConcernKey,
  type SkinProfile,
} from "@/lib/skin";

/** Evidence for a recommendation: the user's actual score for a concern this
 *  product targets. Lets the UI show proof, not just a conclusion. */
export interface MatchEvidence {
  key: ConcernKey;
  label: string;
  score: number;
}

export interface MatchResult {
  product: Product;
  // 0-100 personalized match score.
  score: number;
  // The user's concerns this product meaningfully addresses, worst-first.
  addresses: ConcernKey[];
  // Human-readable reason for the recommendation.
  reason: string;
  // The scores behind the reason, worst-first.
  evidence: MatchEvidence[];
}

// A concern is "in need" below this score (higher score = healthier).
const NEED_THRESHOLD = 80;

/**
 * Ranks the catalog for a given skin profile. Products that target the user's
 * lowest-scoring (most in-need) concerns rank highest. Deterministic and
 * explainable — every score can be traced back to concern deficits.
 */
export function rankProducts(
  profile: SkinProfile,
  catalog: Product[] = PRODUCTS,
): MatchResult[] {
  const maxDeficit = Math.max(
    1,
    ...ALL_CONCERNS.map((c) => 100 - profile.scores[c]),
  );

  const results = catalog.map((product) => {
    let raw = 0;
    const addresses: { key: ConcernKey; deficit: number }[] = [];

    for (const key of product.concerns) {
      const deficit = 100 - profile.scores[key]; // how much help is needed
      raw += deficit;
      if (profile.scores[key] < NEED_THRESHOLD) {
        addresses.push({ key, deficit });
      }
    }

    // Normalize: average deficit across the concerns this product targets,
    // scaled against the user's single worst concern so a product hitting the
    // #1 priority can approach 100.
    const avgDeficit = raw / Math.max(1, product.concerns.length);
    const score = Math.round(
      Math.min(100, (avgDeficit / maxDeficit) * 100 * 0.85 + coverageBonus(addresses.length)),
    );

    addresses.sort((a, b) => b.deficit - a.deficit);
    const addressKeys = addresses.map((a) => a.key);

    return {
      product,
      score,
      addresses: addressKeys,
      reason: buildReason(addressKeys),
      evidence: addressKeys.map((key) => ({
        key,
        label: CONCERN_META[key].label,
        score: profile.scores[key],
      })),
    };
  });

  return results.sort((a, b) => b.score - a.score);
}

function coverageBonus(count: number): number {
  // Small reward for products that hit multiple in-need concerns at once.
  return Math.min(15, count * 6);
}

function buildReason(keys: ConcernKey[]): string {
  if (keys.length === 0) return "A solid everyday staple for maintaining healthy skin.";
  const labels = keys.map((k) => CONCERN_META[k].label.toLowerCase());
  if (labels.length === 1) return `Targets your ${labels[0]}.`;
  if (labels.length === 2) return `Targets your ${labels[0]} and ${labels[1]}.`;
  return `Targets your ${labels[0]}, ${labels[1]} and ${labels[2]}.`;
}

/** The single best "hero" recommendation for the top-of-report callout. */
export function heroPick(profile: SkinProfile): MatchResult | null {
  const ranked = rankProducts(profile);
  return ranked[0] ?? null;
}

/**
 * Best value for the user's #1 concern: among products that target it, the one
 * with the best match-per-dollar. Surfaces the cheap workhorse instead of
 * always pushing the most expensive formula.
 */
export function bestValuePick(profile: SkinProfile): MatchResult | null {
  const top = rankedConcerns(profile)[0];
  const candidates = rankProducts(profile).filter((r) =>
    r.product.concerns.includes(top),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, r) =>
    r.score / r.product.price > best.score / best.product.price ? r : best,
  );
}

export type RoutineTier = "starter" | "complete";

export interface RoutineStep {
  slot: string; // "Cleanse", "Treat", "Moisturize", "Protect"
  product: Product;
  why: string;
}

export interface Routine {
  am: RoutineStep[];
  pm: RoutineStep[];
  total: number;
}

/**
 * Builds an ordered AM/PM routine from the user's top matches.
 *
 * Correct skincare order is thin→thick: cleanse, treat, moisturize, and SPF
 * last in the morning. `starter` keeps only the essentials (cleanser +
 * one treatment + moisturizer, plus SPF in the AM) to keep the basket small.
 */
export function buildRoutine(
  profile: SkinProfile,
  tier: RoutineTier = "complete",
): Routine {
  const ranked = rankProducts(profile);
  const byCategory = (cats: string[]) =>
    ranked.find((r) => cats.includes(r.product.category));
  const byConcern = (keys: ConcernKey[], exclude?: Product) =>
    ranked.find(
      (r) =>
        r.product !== exclude &&
        !["Cleanser", "SPF", "Moisturizer"].includes(r.product.category) &&
        r.product.concerns.some((c) => keys.includes(c)),
    );

  const cleanser = byCategory(["Cleanser"]);
  const moisturizer = byCategory(["Moisturizer"]);
  const spf = byCategory(["SPF"]);
  // Daytime favours antioxidant/brightening; night favours renewal.
  const dayTreat = byConcern(["radiance", "age_spot", "redness"]);
  const nightTreat = byConcern(
    ["wrinkle", "acne", "texture", "pore", "firmness"],
    dayTreat?.product,
  );
  const eye = byCategory(["Eye Care"]);

  const step = (slot: string, r?: MatchResult): RoutineStep | null =>
    r ? { slot, product: r.product, why: r.reason } : null;

  const amRaw = [
    step("Cleanse", cleanser),
    tier === "complete" ? step("Treat", dayTreat) : null,
    step("Moisturize", moisturizer),
    step("Protect", spf),
  ];
  const pmRaw = [
    step("Cleanse", cleanser),
    step("Treat", nightTreat ?? dayTreat),
    tier === "complete" ? step("Eyes", eye) : null,
    step("Moisturize", moisturizer),
  ];

  const compact = (steps: (RoutineStep | null)[]) =>
    steps.filter((s): s is RoutineStep => s !== null);

  const am = compact(amRaw);
  const pm = compact(pmRaw);

  // Unique products across both routines (cleanser/moisturizer are shared).
  const unique = new Map<string, Product>();
  [...am, ...pm].forEach((s) => unique.set(s.product.id, s.product));
  const total = [...unique.values()].reduce((sum, p) => sum + p.price, 0);

  return { am, pm, total };
}

/** The distinct products in a routine (for "add all to bag"). */
export function routineProducts(routine: Routine): Product[] {
  const unique = new Map<string, Product>();
  [...routine.am, ...routine.pm].forEach((s) =>
    unique.set(s.product.id, s.product),
  );
  return [...unique.values()];
}
