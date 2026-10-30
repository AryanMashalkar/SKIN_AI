// The occasion stylist's tools, and the rules-only planner that uses them
// when no model is configured.
//
// Contract: the model plans and explains; it never measures. Every number a
// look shows (fit, ΔE, verdict, price, total) is computed here from the scan
// and the catalogue, and `proposeLook` rejects a look that is over budget or
// wears a colour that clashes with the shopper's palette. Pure and
// deterministic, so it is unit-tested (scripts/agent.test.mjs) and shared by
// the AI loop (Groq) and the fallback planner.

import {
  GARMENTS,
  OCCASIONS,
  garmentById,
  type Garment,
  type Occasion,
} from "@/lib/fashion/products";
import { rankColourwaysForSkin, deriveStyleProfile, REDNESS_ELEVATED_BELOW } from "@/lib/fashion/styling";
import type { ColourwayVerdict } from "@/lib/fashion/colourways";
import type { SkinProfile } from "@/lib/skin";

export interface LookItem {
  garmentId: string;
  colourwayId: string;
  garmentName: string;
  colourName: string;
  colourHex: string;
  price: number;
  /** Measured, from the colourway ranking. Never from the model. */
  fit: number;
  verdict: ColourwayVerdict;
  /** A red-family colour chosen while the scan flags redness. */
  red: boolean;
  reason: string;
  /** The stylist's own words on why this piece suits the occasion. */
  why: string;
}

export interface TraceStep {
  tool: string;
  input: Record<string, unknown>;
  summary: string;
}

export interface Look {
  headline: string;
  note: string;
  items: LookItem[];
  total: number;
  budget: number | null;
  /** Who planned it: the AI model with these tools, or the rules-only fallback. */
  source: "ai" | "rules";
  trace: TraceStep[];
}

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

// ---- read_scan ---------------------------------------------------------------

export function readScan(profile: SkinProfile): ToolResult {
  const tone = profile.tone;
  if (!tone) {
    return {
      ok: false,
      error:
        "This scan has no measured colour tone, so colourways cannot be ranked. Ask the shopper to rescan in even light.",
    };
  }
  const style = deriveStyleProfile(profile);
  return {
    ok: true,
    data: {
      season: tone.seasonLabel,
      temperature: style.recommend,
      palette: tone.palette.map((p) => p.name),
      season_confidence: tone.analysis?.confidence ?? null,
      low_confidence_sample: Boolean(tone.lowConfidence),
      redness_score: profile.scores.redness,
      redness_flagged: profile.scores.redness < REDNESS_ELEVATED_BELOW,
      concern_scores_simulated: Boolean(profile.demo),
    },
  };
}

// ---- search_catalog ------------------------------------------------------------

export function searchCatalog(input: { occasion?: string | null; max_price?: number | null }): ToolResult {
  const occasion = input.occasion ?? null;
  if (occasion && !OCCASIONS.includes(occasion as Occasion)) {
    return { ok: false, error: `Unknown occasion "${occasion}". Use one of: ${OCCASIONS.join(", ")}.` };
  }
  const maxPrice = input.max_price ?? null;
  const matches = GARMENTS.filter(
    (g) =>
      (!occasion || g.occasions.includes(occasion as Occasion)) &&
      (maxPrice === null || g.price <= maxPrice),
  );
  return {
    ok: true,
    data: matches.map((g) => ({
      garment_id: g.id,
      name: g.name,
      category: g.category,
      price_usd: g.price,
      occasions: g.occasions,
      colourways: g.colourways.map((c) => c.name),
    })),
  };
}

// ---- rank_colours ----------------------------------------------------------------

export function rankColours(profile: SkinProfile, input: { garment_id: string }): ToolResult {
  const garment = garmentById(input.garment_id);
  if (!garment) return { ok: false, error: `No garment with id "${input.garment_id}".` };
  const ranking = rankColourwaysForSkin(profile, garment);
  if (ranking.length === 0) {
    return { ok: false, error: "No measured colour tone on this scan, so colourways cannot be ranked." };
  }
  return {
    ok: true,
    data: ranking.map((r) => ({
      colourway_id: r.colourway.id,
      colour: r.colourway.name,
      verdict: r.verdict,
      fit: r.fit,
      delta_e: r.deltaE,
      red_near_flagged_redness: r.redFlag,
      reason: r.reason,
    })),
  };
}

// ---- find_pieces --------------------------------------------------------------------

/**
 * search_catalog and rank_colours in one call: every matching piece with its
 * colourways already ranked for this scan. Compact on purpose, because the
 * model resends tool output on every turn and token budgets are tight.
 */
export function findPieces(
  profile: SkinProfile,
  input: { occasion?: string | null; max_price?: number | null },
): ToolResult {
  const found = searchCatalog(input);
  if (!found.ok) return found;
  if (!profile.tone) return { ok: false, error: "No measured colour tone on this scan, so colourways cannot be ranked." };
  const pieces = (found.data as { garment_id: string }[]).map(({ garment_id }) => {
    const g = garmentById(garment_id)!;
    return {
      id: g.id,
      name: g.name,
      category: g.category,
      price: g.price,
      colours: rankColourwaysForSkin(profile, g).map((r) => ({
        id: r.colourway.id,
        colour: r.colourway.name,
        verdict: r.verdict,
        fit: r.fit,
        ...(r.redFlag ? { red: true } : {}),
      })),
    };
  });
  return { ok: true, data: pieces };
}

// ---- propose_look ------------------------------------------------------------------

export interface ProposeInput {
  headline: string;
  note: string;
  budget_usd: number | null;
  items: { garment_id: string; colourway_id: string; why: string }[];
}

/**
 * Validates and assembles the final look. Rejections come back as tool errors
 * so the model can fix the look and propose again, rather than the server
 * silently "correcting" it.
 *
 * The budget is the store's, not the model's: a USD budget stated in the brief
 * is enforced even if the model omits it, and a budget in another currency is
 * never applied (the model is not trusted to convert). The note is rebuilt by
 * `composeNote`, so every factual sentence on the card is the store's.
 */
export function proposeLook(
  profile: SkinProfile,
  input: ProposeInput,
  brief = "",
): { ok: true; look: Omit<Look, "source" | "trace"> } | { ok: false; error: string } {
  if (!input.items?.length) return { ok: false, error: "A look needs at least one item." };
  if (input.items.length > 3) return { ok: false, error: "Keep a look to three items or fewer." };

  const seen = new Set<string>();
  const items: LookItem[] = [];
  for (const item of input.items) {
    const garment = garmentById(item.garment_id);
    if (!garment) return { ok: false, error: `No garment with id "${item.garment_id}".` };
    if (seen.has(garment.id)) return { ok: false, error: `${garment.name} is in the look twice.` };
    seen.add(garment.id);

    const ranked = rankColourwaysForSkin(profile, garment).find(
      (r) => r.colourway.id === item.colourway_id,
    );
    if (!ranked) {
      return {
        ok: false,
        error: `"${item.colourway_id}" is not a colourway of ${garment.name}. Use an id from find_pieces.`,
      };
    }
    if (ranked.verdict === "clash") {
      return {
        ok: false,
        error: `${garment.name} in ${ranked.colourway.name} clashes with this shopper's palette (${ranked.reason}) Pick another colourway or garment.`,
      };
    }
    items.push(toItem(garment, ranked, item.why));
  }

  const total = items.reduce((s, i) => s + i.price, 0);
  const budget = hasForeignBudget(brief) ? null : (budgetFromBrief(brief) ?? input.budget_usd ?? null);
  if (budget !== null && total > budget) {
    return {
      ok: false,
      error: `This look totals $${total}, over the $${budget} budget. Drop or swap an item.`,
    };
  }

  return {
    ok: true,
    look: {
      headline: input.headline,
      note: composeNote(profile, input.note, items, total, budget, brief),
      items,
      total,
      budget,
    },
  };
}

/** Sentences about money, redness or scores: facts only the store may state. */
const FACT_SENTENCE = /[$₹€£]|\b(usd|inr|rupees?|budget|price[sd]?|cost|afford|reds?|redness|scores?|fit of|ΔE|delta)\b/i;

/**
 * The card's note: the model's styling sentences, minus any sentence that
 * states a fact (budget, currency, redness, scores), followed by the facts as
 * the store computed them from the actual look. Live testing showed the model
 * claiming "reds were avoided" beside a brick tee, and converting a rupee
 * budget it was told not to touch; this makes both impossible.
 */
export function composeNote(
  profile: SkinProfile,
  modelNote: string,
  items: LookItem[],
  total: number,
  budget: number | null,
  brief: string,
): string {
  const styling = modelNote
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !FACT_SENTENCE.test(s));

  const facts: string[] = [];
  if (budget !== null) facts.push(`Total $${total} of your $${budget} budget.`);
  if (hasForeignBudget(brief)) facts.push("Your budget isn't in USD, so it wasn't applied (prices are USD).");
  if (profile.scores.redness < REDNESS_ELEVATED_BELOW) {
    const reds = items.filter((i) => i.red);
    facts.push(
      reds.length === 0
        ? "Redness is flagged today, so no red tones were chosen."
        : `Redness is flagged today; the ${reds.map((i) => `${i.colourName} ${i.garmentName}`).join(" and ")} ${reds.length === 1 ? "is a red tone" : "are red tones"}.`,
    );
  }
  return [...styling, ...facts].join(" ");
}

function toItem(
  garment: Garment,
  ranked: ReturnType<typeof rankColourwaysForSkin>[number],
  why: string,
): LookItem {
  return {
    garmentId: garment.id,
    colourwayId: ranked.colourway.id,
    garmentName: garment.name,
    colourName: ranked.colourway.name,
    colourHex: ranked.colourway.hex,
    price: garment.price,
    fit: ranked.fit,
    verdict: ranked.verdict,
    red: ranked.redFlag,
    reason: ranked.reason,
    why,
  };
}

// ---- rules-only fallback ------------------------------------------------------------

const OCCASION_WORDS: [RegExp, Occasion][] = [
  [/\b(hike|hiking|trek|trekking|camp|mountain|snow|ski|outdoor|picnic|garden)\b/i, "outdoor"],
  [/\b(trip|travel|flight|airport|vacation|holiday)\b/i, "travel"],
  [/\b(party|date|club|concert|night|evening|dinner|reception)\b/i, "evening"],
  [/\b(office|work|interview|meeting|presentation|brunch|lunch|wedding|smart)\b/i, "smart-casual"],
];

/** The occasion a brief names, by keyword. Defaults to everyday. */
export function occasionFromBrief(brief: string): Occasion {
  for (const [rx, occasion] of OCCASION_WORDS) if (rx.test(brief)) return occasion;
  return "everyday";
}

/**
 * A USD budget the brief states ("under $150", "budget 120", "max $90").
 * Other currencies return null rather than a guessed conversion.
 */
const FOREIGN_BUDGET = /(₹|\brs\.?|\binr|€|\beur|£|\bgbp)\s?\d/i;

/** True when the brief states a budget in a currency other than USD. */
export function hasForeignBudget(brief: string): boolean {
  return FOREIGN_BUDGET.test(brief);
}

export function budgetFromBrief(brief: string): number | null {
  if (hasForeignBudget(brief)) return null;
  const m =
    brief.match(/\$\s?(\d{2,5})/) ??
    brief.match(/\b(?:under|below|budget(?: of| is)?|max(?:imum)?|up to|within)\s+\$?(\d{2,5})\b/i);
  return m ? Number(m[1]) : null;
}

/**
 * Plans a look without a model: for the brief's occasion, take each matching
 * garment's best non-clashing colourway, then choose the combination of at
 * most one outerwear and one top with the highest total fit within budget.
 */
export function planWithoutModel(profile: SkinProfile, brief: string): Look | { error: string } {
  const trace: TraceStep[] = [];
  const scan = readScan(profile);
  trace.push({ tool: "read_scan", input: {}, summary: scan.ok ? "Read season and redness" : scan.error });
  if (!scan.ok) return { error: scan.error };

  const occasion = occasionFromBrief(brief);
  const budget = budgetFromBrief(brief);
  const found = GARMENTS.filter((g) => g.occasions.includes(occasion));
  trace.push({
    tool: "search_catalog",
    input: { occasion, max_price: budget },
    summary: `${found.length} ${found.length === 1 ? "piece" : "pieces"} for ${occasion}`,
  });

  const candidates = found
    .map((g) => {
      // Best non-clashing colourway, skipping reds while redness is flagged
      // unless reds are all this garment comes in.
      const usable = rankColourwaysForSkin(profile, g).filter((r) => r.verdict !== "clash");
      const best = usable.find((r) => !r.redFlag) ?? usable[0];
      trace.push({
        tool: "rank_colours",
        input: { garment_id: g.id },
        summary: best ? `${g.name}: ${best.colourway.name} (fit ${best.fit})` : `${g.name}: every colourway clashes`,
      });
      // No "why": the rules planner has no styling reasoning to offer beyond
      // the measured reason, and filler copy would pretend otherwise.
      return best ? toItem(g, best, "") : null;
    })
    .filter((x): x is LookItem => x !== null);

  const outer = candidates.filter((c) => garmentById(c.garmentId)?.category === "Outerwear");
  const tops = candidates.filter((c) => garmentById(c.garmentId)?.category !== "Outerwear");
  const combos: LookItem[][] = [];
  for (const t of [null, ...tops]) {
    for (const o of [null, ...outer]) {
      const combo = [t, o].filter((x): x is LookItem => x !== null);
      if (combo.length) combos.push(combo);
    }
  }
  const affordable = combos.filter((c) => budget === null || c.reduce((s, i) => s + i.price, 0) <= budget);
  if (!affordable.length) {
    return { error: `Nothing for ${occasion} fits${budget !== null ? ` a $${budget} budget` : ""} without clashing with your palette.` };
  }
  const score = (c: LookItem[]) => c.reduce((s, i) => s + i.fit, 0);
  const best = affordable.sort((a, b) => score(b) - score(a) || b.length - a.length)[0];

  return {
    headline: `Your ${occasion} look`,
    note:
      "Best non-clashing colour per piece, highest total fit" +
      (budget !== null ? ` within $${budget}.` : ".") +
      (hasForeignBudget(brief) ? " Your budget isn't in USD, so it wasn't applied (prices are USD)." : "") +
      (profile.scores.redness < REDNESS_ELEVATED_BELOW ? " Redness is flagged today, so reds are avoided wherever another colour fits." : ""),
    items: best,
    total: best.reduce((s, i) => s + i.price, 0),
    budget,
    source: "rules",
    trace,
  };
}
