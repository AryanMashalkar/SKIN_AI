import { PRODUCTS, type Product } from "@/lib/products";
import {
  ALL_CONCERNS,
  CONCERN_META,
  type ConcernKey,
  type SkinProfile,
} from "@/lib/skin";

export interface MatchResult {
  product: Product;
  // 0-100 personalized match score.
  score: number;
  // The user's concerns this product meaningfully addresses, worst-first.
  addresses: ConcernKey[];
  // Human-readable reason for the recommendation.
  reason: string;
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

/** Builds a simple AM/PM routine from the top matches. */
export function buildRoutine(profile: SkinProfile): {
  am: Product[];
  pm: Product[];
} {
  const ranked = rankProducts(profile).map((r) => r.product);
  const pick = (cats: string[]) =>
    ranked.find((p) => cats.includes(p.category));

  const cleanser = pick(["Cleanser"]);
  const treatmentDay = ranked.find((p) =>
    p.concerns.some((c) => ["radiance", "age_spot"].includes(c)),
  );
  const moisturizer = pick(["Moisturizer"]);
  const spf = ranked.find((p) => p.category === "SPF");
  const treatmentNight = ranked.find((p) =>
    p.concerns.some((c) => ["wrinkle", "acne", "texture"].includes(c)),
  );

  const dedupe = (arr: (Product | undefined)[]) =>
    arr.filter((p, i, a): p is Product => !!p && a.indexOf(p) === i);

  return {
    am: dedupe([cleanser, treatmentDay, moisturizer, spf]),
    pm: dedupe([cleanser, treatmentNight, moisturizer]),
  };
}
