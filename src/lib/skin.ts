// Client-safe skin analysis domain model.
// Shared between the server (Perfect Corp integration) and the UI.

export type ConcernKey =
  | "moisture"
  | "redness"
  | "oiliness"
  | "pore"
  | "texture"
  | "acne"
  | "wrinkle"
  | "firmness"
  | "radiance"
  | "dark_circle"
  | "age_spot";

// Our concern key -> Perfect Corp Skin Analysis v2.1 SD-tier `dst_actions`.
// (SD and HD actions cannot be mixed in a single request.)
export const CONCERN_TO_DST_ACTION: Record<ConcernKey, string> = {
  moisture: "moisture",
  redness: "redness",
  oiliness: "oiliness",
  pore: "pore",
  texture: "texture",
  acne: "acne",
  wrinkle: "wrinkle",
  firmness: "firmness",
  radiance: "radiance",
  dark_circle: "dark_circle_v2",
  age_spot: "age_spot",
};

export const ALL_CONCERNS = Object.keys(CONCERN_TO_DST_ACTION) as ConcernKey[];

export interface ConcernMeta {
  key: ConcernKey;
  label: string;
  short: string;
  // What a good product should contain to improve this concern.
  lookFor: string[];
  // Hue used for gauges / accents.
  hue: number;
}

export const CONCERN_META: Record<ConcernKey, ConcernMeta> = {
  moisture: {
    key: "moisture",
    label: "Hydration",
    short: "Moisture level in the stratum corneum",
    lookFor: ["Hyaluronic Acid", "Glycerin", "Squalane", "Ceramides"],
    hue: 199,
  },
  redness: {
    key: "redness",
    label: "Redness",
    short: "Visible irritation and inflammation",
    lookFor: ["Centella Asiatica", "Niacinamide", "Allantoin", "Green Tea"],
    hue: 0,
  },
  oiliness: {
    key: "oiliness",
    label: "Oil Balance",
    short: "Sebum production across the T-zone",
    lookFor: ["Niacinamide", "Zinc PCA", "Salicylic Acid"],
    hue: 45,
  },
  pore: {
    key: "pore",
    label: "Pores",
    short: "Visible pore size and congestion",
    lookFor: ["Salicylic Acid", "Niacinamide", "Retinol"],
    hue: 265,
  },
  texture: {
    key: "texture",
    label: "Texture",
    short: "Smoothness and surface evenness",
    lookFor: ["Glycolic Acid", "Lactic Acid", "PHA"],
    hue: 28,
  },
  acne: {
    key: "acne",
    label: "Breakouts",
    short: "Active blemishes and acne susceptibility",
    lookFor: ["Salicylic Acid", "Benzoyl Peroxide", "Azelaic Acid"],
    hue: 350,
  },
  wrinkle: {
    key: "wrinkle",
    label: "Fine Lines",
    short: "Wrinkle depth and expression lines",
    lookFor: ["Retinol", "Peptides", "Bakuchiol"],
    hue: 220,
  },
  firmness: {
    key: "firmness",
    label: "Firmness",
    short: "Elasticity and structural bounce",
    lookFor: ["Peptides", "Vitamin C", "Retinol"],
    hue: 160,
  },
  radiance: {
    key: "radiance",
    label: "Radiance",
    short: "Overall glow and luminosity",
    lookFor: ["Vitamin C", "Alpha Arbutin", "Ferulic Acid"],
    hue: 48,
  },
  dark_circle: {
    key: "dark_circle",
    label: "Dark Circles",
    short: "Under-eye pigmentation and shadowing",
    lookFor: ["Caffeine", "Vitamin K", "Peptides"],
    hue: 280,
  },
  age_spot: {
    key: "age_spot",
    label: "Dark Spots",
    short: "Hyperpigmentation and sun damage",
    lookFor: ["Vitamin C", "Alpha Arbutin", "Tranexamic Acid", "Niacinamide"],
    hue: 20,
  },
};

export type Severity = "healthy" | "mild" | "moderate" | "severe";

// Scores are 0-100 where HIGHER = HEALTHIER (Perfect Corp convention).
export function severityFor(score: number): Severity {
  if (score >= 90) return "healthy";
  if (score >= 75) return "mild";
  if (score >= 60) return "moderate";
  return "severe";
}

export const SEVERITY_META: Record<
  Severity,
  { label: string; tone: string; ring: string; text: string }
> = {
  healthy: {
    label: "Healthy",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "#10b981",
    text: "text-emerald-600",
  },
  mild: {
    label: "Mild",
    tone: "bg-sky-50 text-sky-700 border-sky-200",
    ring: "#0ea5e9",
    text: "text-sky-600",
  },
  moderate: {
    label: "Watch",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
    ring: "#f59e0b",
    text: "text-amber-600",
  },
  severe: {
    label: "Priority",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    ring: "#f43f5e",
    text: "text-rose-600",
  },
};

export interface SkinProfile {
  scores: Record<ConcernKey, number>;
  skinAge: number;
  skinType: string;
  overall: number;
  demo: boolean;
  capturedAt: string;
  // Personal-colour analysis sampled from the selfie (optional — present when
  // the tone sampler succeeds). Typed as SkinTone in lib/color to avoid a hard
  // import cycle here; see lib/color.ts.
  tone?: import("@/lib/color").SkinTone;
}

/** Concerns sorted worst-first (lowest score = most in need of care). */
export function rankedConcerns(profile: SkinProfile): ConcernKey[] {
  return [...ALL_CONCERNS].sort((a, b) => profile.scores[a] - profile.scores[b]);
}

export function topConcerns(profile: SkinProfile, n = 3): ConcernKey[] {
  return rankedConcerns(profile).slice(0, n);
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ---- recency + progress ---------------------------------------------------

/** Whole days since a profile was captured. */
export function daysSince(profile: SkinProfile): number {
  const then = new Date(profile.capturedAt).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** Friendly relative label, e.g. "today", "3 days ago", "2 weeks ago". */
export function lastScannedLabel(profile: SkinProfile): string {
  const d = daysSince(profile);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

/** Skin renews on roughly a 4-week cycle — the point at which a rescan is
 *  meaningful rather than noise. */
export const RESCAN_AFTER_DAYS = 28;

export function isRescanDue(profile: SkinProfile): boolean {
  return daysSince(profile) >= RESCAN_AFTER_DAYS;
}

export function daysUntilRescan(profile: SkinProfile): number {
  return Math.max(0, RESCAN_AFTER_DAYS - daysSince(profile));
}

export interface ConcernDelta {
  key: ConcernKey;
  from: number;
  to: number;
  delta: number; // positive = improved (higher score = healthier)
}

/** Per-concern change between two scans, biggest movement first. */
export function progressBetween(
  previous: SkinProfile,
  current: SkinProfile,
): ConcernDelta[] {
  return ALL_CONCERNS.map((key) => {
    const from = previous.scores[key];
    const to = current.scores[key];
    return { key, from, to, delta: to - from };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Concerns that moved enough to be worth reporting (noise floor ±3). */
export function meaningfulDeltas(
  previous: SkinProfile,
  current: SkinProfile,
  minChange = 3,
): ConcernDelta[] {
  return progressBetween(previous, current).filter(
    (d) => Math.abs(d.delta) >= minChange,
  );
}

// Shape of one entry in the Perfect Corp `results.output` array.
interface OutputItem {
  type?: string;
  ui_score?: number;
  raw_score?: number;
  score?: number;
  region?: string;
  skin_type?: string;
}

/**
 * Normalizes a Perfect Corp Skin Analysis (v2.1) success payload.
 *
 * Verified live response shape:
 *   { task_status: "success",
 *     results: { output: [
 *       { type: "firmness", ui_score: 64, raw_score: 41.6 },   // per-concern
 *       ...
 *       { type: "skin_type", region: "whole", skin_type: "Combination" },
 *       { type: "all",      score: 70.7 },   // overall health 0-100
 *       { type: "skin_age", score: 63 },     // estimated skin age
 *       { type: "resize_image" }
 *     ] } }
 *
 * Scores are 0-100 where HIGHER = HEALTHIER (we use `ui_score`).
 */
export function normalizeApiResult(raw: unknown): SkinProfile {
  const output = findOutputArray(raw);

  const byType = new Map<string, number>();
  const skinTypeByRegion: Record<string, string> = {};
  let allScore: number | undefined;
  let apiSkinAge: number | undefined;

  for (const item of output) {
    const type = item.type;
    if (!type) continue;
    if (type === "skin_type") {
      if (item.region && item.skin_type)
        skinTypeByRegion[item.region] = item.skin_type;
      continue;
    }
    if (type === "all") {
      allScore = num(item.score ?? item.ui_score);
      continue;
    }
    if (type === "skin_age") {
      apiSkinAge = num(item.score ?? item.raw_score);
      continue;
    }
    if (type === "resize_image") continue;

    const score = num(item.ui_score ?? item.score);
    if (score !== undefined) byType.set(type, score);
  }

  const scores = {} as Record<ConcernKey, number>;
  for (const key of ALL_CONCERNS) {
    // Our concern -> Perfect Corp dst_action / output `type` (e.g.
    // dark_circle -> dark_circle_v2).
    const action = CONCERN_TO_DST_ACTION[key];
    const s = byType.get(action) ?? byType.get(key);
    scores[key] = s === undefined ? 78 : clamp(s);
  }

  const overall =
    allScore !== undefined
      ? clamp(allScore)
      : Math.round(
          ALL_CONCERNS.reduce((sum, k) => sum + scores[k], 0) /
            ALL_CONCERNS.length,
        );

  const skinType =
    skinTypeByRegion.whole ??
    Object.values(skinTypeByRegion)[0] ??
    deriveSkinType(scores);

  const skinAge =
    apiSkinAge !== undefined ? Math.round(apiSkinAge) : estimateSkinAge(scores);

  return {
    scores,
    skinAge,
    skinType,
    overall,
    demo: false,
    capturedAt: new Date().toISOString(),
  };
}

// ---- internal parsing helpers -------------------------------------------

function num(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

/** Locates the `output` array of concern items, tolerating response wrapping. */
function findOutputArray(raw: unknown): OutputItem[] {
  const r = raw as Record<string, unknown> | null | undefined;
  const direct = [
    (r?.results as { output?: unknown })?.output,
    (r?.result as { output?: unknown })?.output,
    ((r?.data as { results?: { output?: unknown } })?.results)?.output,
    (r as { output?: unknown })?.output,
  ];
  for (const c of direct) if (Array.isArray(c)) return c as OutputItem[];

  // Deep fallback: find any array of objects that carry a `type` + score field.
  let found: OutputItem[] = [];
  const visit = (o: unknown) => {
    if (found.length || !o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      if (
        o.some(
          (it) =>
            it &&
            typeof it === "object" &&
            "type" in it &&
            ("ui_score" in it || "score" in it),
        )
      ) {
        found = o as OutputItem[];
        return;
      }
      o.forEach(visit);
      return;
    }
    for (const v of Object.values(o as Record<string, unknown>)) visit(v);
  };
  visit(raw);
  return found;
}

function estimateSkinAge(scores: Record<ConcernKey, number>): number {
  // Lower firmness / wrinkle / radiance scores => older apparent skin age.
  const aging = (scores.wrinkle + scores.firmness + scores.radiance) / 3;
  return Math.round(24 + (100 - aging) * 0.35);
}

function deriveSkinType(scores: Record<ConcernKey, number>): string {
  const oily = scores.oiliness < 65;
  const dry = scores.moisture < 65;
  if (oily && dry) return "Combination";
  if (oily) return "Oily";
  if (dry) return "Dry";
  return "Normal";
}
