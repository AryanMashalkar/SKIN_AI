// Skin-informed styling engine — the bridge between the two Perfect Corp APIs.
//
// When a personal-colour analysis is available (skin tone sampled from the
// selfie -> CIELAB / ITA° / 12-season, see lib/color.ts), garments are matched
// to the shopper's SEASON: colours in their palette flatter them, colours in
// the opposite temperature can fight their complexion. This is the real
// methodology of a professional colour analyst.
//
// If no tone is available we fall back to a lighter-weight proxy driven by the
// Skin Analysis redness/radiance scores, so the feature still works.
//
// Everything is deterministic and explainable — every verdict traces to a
// measured value. This is a cosmetic / styling judgement, never medical advice.

import type { Garment } from "@/lib/fashion/products";
import type { SkinProfile } from "@/lib/skin";
import {
  rankColourways,
  type RankedColourway,
} from "@/lib/fashion/colourways";
import {
  UNDERTONE_LABEL,
  type Undertone,
} from "@/lib/color";

export type PaletteTemp = "cool" | "warm" | "balanced";

export interface StyleProfile {
  /** Colour temperature to steer toward. */
  recommend: PaletteTemp;
  /** True when tone came from a real personal-colour analysis. */
  hasTone: boolean;
  undertone: Undertone;
  seasonLabel?: string;
  /** Palette swatches for the shopper's season (empty in proxy mode). */
  palette: { hex: string; name: string }[];
  headline: string;
  rationale: string[];
}

export const REDNESS_ELEVATED_BELOW = 78;
const RADIANCE_LOW_BELOW = 78;

/** Derives a styling recommendation from a skin profile. */
export function deriveStyleProfile(profile: SkinProfile): StyleProfile {
  const tone = profile.tone;

  // --- Primary path: real personal-colour analysis --------------------------
  if (tone) {
    // Prefer the three-axis hue reading over the skin-only undertone when it is
    // available. Skin undertone alone frequently reads "neutral" (the b*-a* gap
    // is narrow on most skin), which collapsed genuinely cool or warm people to
    // "balanced" and threw away the hair/eye signal we just collected.
    const hue = tone.analysis?.axes.hue.score;
    const recommend: PaletteTemp =
      hue !== undefined && Math.abs(hue) >= 0.12
        ? hue > 0
          ? "warm"
          : "cool"
        : tone.undertone === "warm"
          ? "warm"
          : tone.undertone === "cool"
            ? "cool"
            : "balanced";

    // Report the axis-derived temperature so the copy matches the ranking.
    const undertone: Undertone =
      recommend === "warm" ? "warm" : recommend === "cool" ? "cool" : "neutral";

    const rationale = [
      tone.analysis
        ? `Measured across skin, hair and eye colour, your ${tone.analysis.dominant} axis dominates — placing you in the ${tone.seasonLabel} palette.`
        : `Your skin tone reads as ${UNDERTONE_LABEL[tone.undertone].toLowerCase()} (ITA° ${tone.ita}), placing you in the ${tone.seasonLabel} palette.`,
      tone.description,
    ];

    return {
      recommend,
      hasTone: true,
      undertone,
      seasonLabel: tone.seasonLabel,
      palette: tone.palette,
      headline: `${tone.seasonLabel} · ${tone.headline}`,
      rationale,
    };
  }

  // --- Fallback path: redness/radiance proxy --------------------------------
  const rednessScore = profile.scores.redness;
  const radianceScore = profile.scores.radiance;
  const rednessElevated = rednessScore < REDNESS_ELEVATED_BELOW;
  const radianceLow = radianceScore < RADIANCE_LOW_BELOW;
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
      `Radiance came in at ${radianceScore}/100 — clearer, higher-contrast colours will lift your complexion.`,
    );
  }

  return {
    recommend,
    hasTone: false,
    undertone: rednessElevated ? "cool" : "neutral",
    palette: [],
    headline: rednessElevated
      ? "Cool, calming tones will flatter you most"
      : "Your complexion is versatile — wear what you love",
    rationale,
  };
}

export interface StyledGarment {
  garment: Garment;
  score: number; // 0-100 flatter score for this complexion
  flatters: boolean;
  caution: boolean;
  reason: string;
}

// Upper/full-body colour sits next to the face and matters most; lower-body
// colour barely affects complexion.
function tempWeight(g: Garment): number {
  return g.garmentCategory === "lower_body" ? 0.3 : 1;
}

/** Ranks garments for a skin profile, best-flattering first. */
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

    // Garment colour temperature comes from the hand-authored `warmth` field.
    // We deliberately do NOT run `analyzeSkinTone` on the swatch: `undertoneOf`
    // thresholds the a*-b* gap at values calibrated for skin (where b* >> a*),
    // and dyed fabric does not live in that region of Lab space. Applying it to
    // a swatch mislabels most garments and makes `buildReason` contradict the
    // garment's own colour name (e.g. "warm brick is a cool shade").
    const garmentWarmth = garment.warmth;

    if (style.recommend === "cool") {
      if (garmentWarmth === "cool") {
        score += 32 * w;
        flatters = true;
      } else if (garmentWarmth === "warm") {
        score -= 28 * w;
        caution = true;
      } else {
        score += 12 * w;
      }
    } else if (style.recommend === "warm") {
      if (garmentWarmth === "warm") {
        score += 32 * w;
        flatters = true;
      } else if (garmentWarmth === "cool") {
        score -= 28 * w;
        caution = true;
      } else {
        score += 12 * w;
      }
    } else {
      // balanced complexion: temperature isn't a strong steer
      score += garmentWarmth === "neutral" ? 8 : 14;
      flatters = garmentWarmth !== "neutral";
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
  const season = style.seasonLabel ?? "your palette";
  if (style.recommend === "warm") {
    if (flatters) return `Its ${garment.colorName} sits right in your warm ${season} palette.`;
    if (caution) return `${cap(garment.colorName)} is a cool shade that can clash with your warm undertone — a warmer tone will suit you more.`;
    return `A safe neutral that won't fight your warm undertone.`;
  }
  if (style.recommend === "cool") {
    if (flatters)
      return style.hasTone
        ? `Its ${garment.colorName} sits right in your cool ${season} palette.`
        : `Its ${garment.colorName} calms the redness your scan flagged.`;
    if (caution)
      return style.hasTone
        ? `${cap(garment.colorName)} is a warm shade that can clash with your cool undertone.`
        : `${cap(garment.colorName)} is warm and can emphasise your flagged redness.`;
    return `A safe neutral that won't compete with your complexion.`;
  }
  return `Your ${style.hasTone ? "neutral undertone" : "balanced complexion"} carries this ${garment.colorName} easily.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Ranks one garment's colourways for this scan: the measured season palette,
 * adjusted for redness flagged on the same scan. Empty when there is no
 * measured tone, so the UI shows colourways unranked instead of guessing.
 */
export function rankColourwaysForSkin(
  profile: SkinProfile,
  garment: Garment,
): RankedColourway[] {
  return rankColourways(garment.colourways, deriveStyleProfile(profile).palette, {
    rednessElevated: profile.scores.redness < REDNESS_ELEVATED_BELOW,
  });
}

export interface ColourProof {
  garment: Garment;
  /** The colourway we recommend for this shopper. */
  best: RankedColourway;
  /** What they would otherwise get: the colour in the photo, or our worst pick. */
  contrast: RankedColourway;
  contrastIs: "as-pictured" | "worst";
}

/**
 * Chooses the proof shot: one upper-body garment rendered twice on the
 * shopper, in our best colourway and in the colour they would have bought from
 * the product photo. When the photo already shows our best pick, the contrast
 * falls back to the worst-ranked colourway. Garments whose photo is *not* our
 * pick come first (that is the real purchase being corrected); among those,
 * the widest fit gap wins, because that is the difference a viewer can see.
 */
export function proofForSkin(
  profile: SkinProfile,
  garments: Garment[],
): ColourProof | null {
  let chosen: ColourProof | null = null;
  let widest = -Infinity;

  for (const garment of garments) {
    if (garment.garmentCategory === "lower_body" || garment.colourways.length < 2) continue;
    const ranking = rankColourwaysForSkin(profile, garment);
    if (ranking.length < 2) continue;

    const best = ranking[0];
    const pictured = ranking.find((r) => r.colourway.original);
    const usePictured = pictured && pictured !== best;
    const contrast = usePictured ? pictured : ranking[ranking.length - 1];
    // Fit is 0-100, so +1000 ranks every as-pictured candidate above any
    // worst-colourway fallback without changing order within each group.
    const gap = best.fit - contrast.fit + (usePictured ? 1000 : 0);

    if (gap > widest) {
      widest = gap;
      chosen = {
        garment,
        best,
        contrast,
        contrastIs: usePictured ? "as-pictured" : "worst",
      };
    }
  }
  return chosen;
}

/** Single garment's styling verdict. */
export function styleForGarment(
  profile: SkinProfile,
  garment: Garment,
): StyledGarment {
  return rankGarmentsForSkin(profile, [garment])[0];
}
