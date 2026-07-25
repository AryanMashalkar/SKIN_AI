// Skin-informed styling engine — the bridge between the two Perfect Corp APIs.
//
// The Skin Analysis API returns objective, per-concern scores (0-100, higher =
// healthier). Two of those concerns map directly onto well-established colour-
// analysis principles that professional stylists and makeup artists use every
// day:
//
//   • REDNESS  — cool, muted tones (blues, teals, cool greys) visually calm
//     visible facial redness, while warm reds / oranges / bricks sit next to
//     the same hue on the colour wheel and amplify it.
//   • RADIANCE — a duller complexion is lifted by clearer, higher-contrast
//     colours worn near the face; muddy, low-contrast tones wash it out.
//
// So a real skin scan can genuinely inform which *garments* flatter a shopper —
// a story a skin-only or apparel-only app cannot tell. Everything here is
// deterministic and explainable: every recommendation traces back to a score.
//
// This is a cosmetic / styling judgement, never a medical claim.

import type { Garment, ColorWarmth } from "@/lib/fashion/products";
import type { SkinProfile } from "@/lib/skin";

export type PaletteTemp = "cool" | "warm" | "balanced";

export interface StyleProfile {
  /** Recommended colour temperature to steer the shopper toward. */
  recommend: PaletteTemp;
  rednessScore: number;
  radianceScore: number;
  /** True when redness is elevated enough to actively steer toward cool tones. */
  rednessElevated: boolean;
  /** True when radiance is low enough to favour clearer, brighter colours. */
  radianceLow: boolean;
  /** One-line headline for the styling banner. */
  headline: string;
  /** Supporting bullet points, each citing a real score. */
  rationale: string[];
}

// A concern score below this is "in need" / elevated (higher score = healthier).
const REDNESS_ELEVATED_BELOW = 78;
const RADIANCE_LOW_BELOW = 78;

/**
 * Derives a styling recommendation from a real skin profile. Grounded in the
 * `redness` and `radiance` scores from the Perfect Corp Skin Analysis API.
 */
export function deriveStyleProfile(profile: SkinProfile): StyleProfile {
  const rednessScore = profile.scores.redness;
  const radianceScore = profile.scores.radiance;
  const rednessElevated = rednessScore < REDNESS_ELEVATED_BELOW;
  const radianceLow = radianceScore < RADIANCE_LOW_BELOW;

  // Redness is the dominant driver of temperature: elevated redness → cool.
  const recommend: PaletteTemp = rednessElevated ? "cool" : "balanced";

  const rationale: string[] = [];
  if (rednessElevated) {
    rationale.push(
      `Your scan read redness at ${rednessScore}/100, so cool, muted tones near your face will calm it — warm reds and oranges tend to amplify it.`,
    );
  } else {
    rationale.push(
      `Your redness is well-balanced (${rednessScore}/100), so you carry both cool and warm tones comfortably.`,
    );
  }
  if (radianceLow) {
    rationale.push(
      `Radiance came in at ${radianceScore}/100 — clearer, higher-contrast colours will lift your complexion more than muted, washed-out shades.`,
    );
  } else {
    rationale.push(
      `Radiance is strong (${radianceScore}/100), so richer and softer shades both read well on you.`,
    );
  }

  const headline = rednessElevated
    ? "Cool, calming tones will flatter you most"
    : radianceLow
      ? "Clear, high-contrast colours will make you glow"
      : "Your complexion is versatile — wear what you love";

  return {
    recommend,
    rednessScore,
    radianceScore,
    rednessElevated,
    radianceLow,
    headline,
    rationale,
  };
}

export interface StyledGarment {
  garment: Garment;
  /** 0-100 flatter score for this complexion. */
  score: number;
  /** True when this garment's colour actively flatters the skin. */
  flatters: boolean;
  /** True when the colour may work against the skin (worth a gentle caution). */
  caution: boolean;
  /** Explainable one-liner shown on the card / try-on modal. */
  reason: string;
}

// How much a garment's colour temperature counts. Colour worn on the upper or
// full body sits right next to the face, so it matters most; lower-body colour
// barely affects complexion.
function tempWeight(g: Garment): number {
  return g.garmentCategory === "lower_body" ? 0.3 : 1;
}

/**
 * Scores and ranks garments for a given skin profile, best-flattering first.
 * Deterministic and explainable.
 */
export function rankGarmentsForSkin(
  profile: SkinProfile,
  garments: Garment[],
): StyledGarment[] {
  const style = deriveStyleProfile(profile);

  const ranked = garments.map((garment) => {
    const w = tempWeight(garment);
    let score = 60;
    let flatters = false;
    let caution = false;

    if (style.recommend === "cool") {
      if (garment.warmth === "cool") {
        score += 32 * w;
        flatters = true;
      } else if (garment.warmth === "warm") {
        score -= 28 * w;
        caution = true;
      } else {
        score += 12 * w; // neutrals are safe
      }
    } else {
      // Balanced complexion: colour temperature is not a strong steer.
      score += garment.warmth === "neutral" ? 8 : 14;
      flatters = garment.warmth !== "neutral";
    }

    // Low radiance rewards clearer/deeper (more saturated) colours; our warm &
    // cool swatches read as clear jewel tones, neutrals read as muted.
    if (style.radianceLow) {
      score += garment.warmth === "neutral" ? -4 : 6 * w;
    }

    score = Math.round(Math.max(0, Math.min(100, score)));

    return {
      garment,
      score,
      flatters,
      caution,
      reason: buildReason(garment, style, flatters, caution),
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

function buildReason(
  garment: Garment,
  style: StyleProfile,
  flatters: boolean,
  caution: boolean,
): string {
  if (style.recommend === "cool") {
    if (flatters) {
      return `Its ${garment.colorName} sits opposite redness on the colour wheel — it visually calms the redness your scan flagged.`;
    }
    if (caution) {
      return `${cap(garment.colorName)} is a warm tone that can emphasise your flagged redness — still fun to try, but a cooler shade will suit you more.`;
    }
    return `A safe neutral that won't compete with your complexion.`;
  }
  // Balanced complexion.
  if (style.radianceLow && garment.warmth !== "neutral") {
    return `The clarity of this ${garment.colorName} adds the contrast your radiance score wants.`;
  }
  return `Your balanced complexion carries this ${garment.colorName} easily.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convenience: quick lookup of a single garment's styling verdict. */
export function styleForGarment(
  profile: SkinProfile,
  garment: Garment,
): StyledGarment {
  return rankGarmentsForSkin(profile, [garment])[0];
}

const WARMTH_LABEL: Record<ColorWarmth, string> = {
  cool: "Cool",
  warm: "Warm",
  neutral: "Neutral",
};

export function warmthLabel(w: ColorWarmth): string {
  return WARMTH_LABEL[w];
}
