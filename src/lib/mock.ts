// Deterministic-ish mock skin profile for demos when no API key is present
// (or when the live call fails mid-demo). Produces a realistic, varied result
// with a couple of clear "priority" concerns so the storefront has something
// meaningful to recommend against.

import {
  ALL_CONCERNS,
  type ConcernKey,
  type SkinProfile,
} from "@/lib/skin";

const PRESETS: Partial<Record<ConcernKey, [number, number]>>[] = [
  // Oily / breakout-prone
  { oiliness: [48, 60], pore: [52, 64], acne: [55, 66], redness: [68, 78] },
  // Dry / dull
  { moisture: [46, 58], radiance: [58, 68], texture: [64, 74], wrinkle: [70, 80] },
  // Aging / firmness
  { wrinkle: [52, 63], firmness: [55, 66], age_spot: [60, 70], radiance: [64, 72] },
  // Sensitive / red
  { redness: [50, 60], moisture: [60, 70], texture: [66, 76] },
];

function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

export function mockSkinProfile(): SkinProfile {
  const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  const scores = {} as Record<ConcernKey, number>;

  for (const key of ALL_CONCERNS) {
    const range = preset[key];
    scores[key] = range ? rand(range[0], range[1]) : rand(78, 94);
  }

  const overall = Math.round(
    ALL_CONCERNS.reduce((sum, k) => sum + scores[k], 0) / ALL_CONCERNS.length,
  );
  const aging = (scores.wrinkle + scores.firmness + scores.radiance) / 3;
  const skinAge = Math.round(24 + (100 - aging) * 0.35);
  const oily = scores.oiliness < 65;
  const dry = scores.moisture < 65;
  const skinType =
    oily && dry ? "Combination" : oily ? "Oily" : dry ? "Dry" : "Normal";

  return {
    scores,
    skinAge,
    skinType,
    overall,
    demo: true,
    capturedAt: new Date().toISOString(),
  };
}
