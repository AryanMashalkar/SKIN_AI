// Inter-rater agreement statistics for season labelling.
//
// These exist to answer a question that must be settled BEFORE the engine is
// scored: how much do trained human analysts agree with each other?
//
// That number is the CEILING. If two analysts agree on exact season only 70% of
// the time, an engine at 70% is performing at human level and chasing 90% is
// chasing noise. Reporting engine accuracy without it is uninterpretable.
//
//   kappa = (p_o - p_e) / (1 - p_e)
//
// where p_o is observed agreement and p_e is agreement expected by chance.
// kappa <= 0 means no better than chance; 1.0 means perfect agreement.

import type { Season } from "@/lib/color";

export interface KappaResult {
  /** Observed agreement, before chance correction. */
  observed: number;
  /** Agreement expected by chance, from the raters' marginal distributions. */
  expected: number;
  /** Chance-corrected agreement. */
  kappa: number;
  /** Number of subjects the statistic was computed over. */
  n: number;
  /** Conventional descriptive band (Landis & Koch). */
  interpretation: string;
}

/** Landis & Koch (1977) descriptive bands. Convention, not a hard rule. */
export function interpretKappa(k: number): string {
  if (k < 0) return "worse than chance";
  if (k < 0.21) return "slight";
  if (k < 0.41) return "fair";
  if (k < 0.61) return "moderate";
  if (k < 0.81) return "substantial";
  return "almost perfect";
}

// ---- season distance (for weighted kappa) ---------------------------------

type Family = "spring" | "summer" | "autumn" | "winter";
type Variant = "light" | "true" | "bright" | "soft" | "deep";

const familyOf = (s: Season) => s.split("-")[1] as Family;
const variantOf = (s: Season) => s.split("-")[0] as Variant;

/** Spring and Autumn are the warm families; Summer and Winter the cool ones. */
const isWarmFamily = (f: Family) => f === "spring" || f === "autumn";

/**
 * Normalised disagreement distance between two seasons, 0 (identical) to 1.
 *
 * The twelve seasons are NOT nominal categories - they are structured on the
 * hue/value/chroma axes. Treating "True Spring vs Light Spring" as exactly as
 * wrong as "True Spring vs Deep Winter" (which unweighted kappa does) both
 * understates real analyst agreement and misrepresents engine error.
 *
 * Hue is weighted heaviest because crossing warm/cool is the primary split in
 * the system: it is the one mistake that makes recommended colours actively
 * unflattering rather than merely suboptimal. Family (Spring vs Autumn within
 * warm) outranks variant (True vs Light within Spring), because family encodes
 * the dominant character while variant only shifts its degree.
 *
 *   True Spring vs Light Spring  -> 0.22  (near miss, same family)
 *   True Spring vs True Autumn   -> 0.33  (same hue, different character)
 *   Light Spring vs Light Summer -> 0.78  (hue flip)
 *   True Spring vs Deep Winter   -> 1.00  (opposite on every axis)
 */
export function seasonDistance(a: Season, b: Season): number {
  if (a === b) return 0;
  const fa = familyOf(a);
  const fb = familyOf(b);
  const hueMismatch = isWarmFamily(fa) === isWarmFamily(fb) ? 0 : 1;
  const familyMismatch = fa === fb ? 0 : 1;
  const variantMismatch = variantOf(a) === variantOf(b) ? 0 : 1;
  return (hueMismatch * 2 + familyMismatch * 1.5 + variantMismatch) / 4.5;
}

// ---- Cohen's kappa (exactly two raters) -----------------------------------

/**
 * Cohen's kappa for two raters over paired labels.
 *
 * `weights` uses `seasonDistance` so near-miss disagreements are penalised
 * less than opposite ones. Pass `weighted: false` for the classic nominal form.
 */
export function cohensKappa(
  a: Season[],
  b: Season[],
  opts: { weighted?: boolean } = {},
): KappaResult {
  if (a.length !== b.length) {
    throw new Error("cohensKappa: rater arrays must be the same length");
  }
  const n = a.length;
  if (n === 0) {
    return { observed: 0, expected: 0, kappa: 0, n: 0, interpretation: "no data" };
  }
  const weighted = opts.weighted ?? true;
  const dist = (x: Season, y: Season) => (weighted ? seasonDistance(x, y) : x === y ? 0 : 1);

  const categories = [...new Set([...a, ...b])];
  const margA = new Map<Season, number>();
  const margB = new Map<Season, number>();
  for (const s of a) margA.set(s, (margA.get(s) ?? 0) + 1);
  for (const s of b) margB.set(s, (margB.get(s) ?? 0) + 1);

  // Observed disagreement.
  let obsDis = 0;
  for (let i = 0; i < n; i++) obsDis += dist(a[i], b[i]);
  obsDis /= n;

  // Disagreement expected from the marginals if the raters were independent.
  let expDis = 0;
  for (const x of categories) {
    for (const y of categories) {
      const p = ((margA.get(x) ?? 0) / n) * ((margB.get(y) ?? 0) / n);
      expDis += p * dist(x, y);
    }
  }

  const observed = 1 - obsDis;
  const expected = 1 - expDis;
  // Perfect expected agreement means chance alone explains everything; kappa
  // is undefined there, so report 0 rather than dividing by zero.
  const kappa = expected === 1 ? 0 : (observed - expected) / (1 - expected);

  return {
    observed,
    expected,
    kappa,
    n,
    interpretation: interpretKappa(kappa),
  };
}

// ---- Fleiss' kappa (three or more raters) ---------------------------------

/**
 * Fleiss' kappa for any number of raters.
 *
 * `subjects` is one array of labels per subject. Every subject must have been
 * rated the same number of times, which Fleiss' formulation requires.
 */
export function fleissKappa(subjects: Season[][]): KappaResult {
  const N = subjects.length;
  if (N === 0) {
    return { observed: 0, expected: 0, kappa: 0, n: 0, interpretation: "no data" };
  }
  const nRaters = subjects[0].length;
  if (subjects.some((s) => s.length !== nRaters)) {
    throw new Error("fleissKappa: every subject needs the same number of ratings");
  }
  if (nRaters < 2) {
    throw new Error("fleissKappa: needs at least 2 raters per subject");
  }

  const categories = [...new Set(subjects.flat())];
  const counts = subjects.map((labels) => {
    const row = new Map<Season, number>();
    for (const l of labels) row.set(l, (row.get(l) ?? 0) + 1);
    return row;
  });

  // P_i: proportion of rater pairs agreeing on subject i.
  let sumPi = 0;
  for (const row of counts) {
    let sq = 0;
    for (const c of row.values()) sq += c * c;
    sumPi += (sq - nRaters) / (nRaters * (nRaters - 1));
  }
  const observed = sumPi / N;

  // P_e: from the overall proportion assigned to each category.
  let expected = 0;
  for (const cat of categories) {
    let total = 0;
    for (const row of counts) total += row.get(cat) ?? 0;
    const p = total / (N * nRaters);
    expected += p * p;
  }

  const kappa = expected === 1 ? 0 : (observed - expected) / (1 - expected);
  return { observed, expected, kappa, n: N, interpretation: interpretKappa(kappa) };
}

// ---- consensus -------------------------------------------------------------

export type ConsensusMethod = "unanimous" | "majority" | "adjudicated" | "unresolved";

export interface Consensus {
  season: Season | null;
  method: ConsensusMethod;
  /** Fraction of raters backing the chosen label. */
  agreement: number;
  /** False when the case must be excluded from headline accuracy. */
  includeInHeadline: boolean;
}

/**
 * Derives a consensus label from raw ratings.
 *
 * Deliberately conservative: a plurality with no majority is left UNRESOLVED
 * rather than silently promoted. Cases the analysts could not settle are
 * exactly the hard ones, and quietly dropping them - or inventing a label for
 * them - inflates the engine's apparent accuracy.
 */
export function deriveConsensus(
  ratings: Season[],
  adjudicated?: Season | null,
): Consensus {
  if (ratings.length === 0) {
    return { season: null, method: "unresolved", agreement: 0, includeInHeadline: false };
  }
  const tally = new Map<Season, number>();
  for (const r of ratings) tally.set(r, (tally.get(r) ?? 0) + 1);
  const [top, count] = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
  const agreement = count / ratings.length;

  if (count === ratings.length) {
    return { season: top, method: "unanimous", agreement, includeInHeadline: true };
  }
  if (adjudicated) {
    return { season: adjudicated, method: "adjudicated", agreement, includeInHeadline: true };
  }
  if (agreement > 0.5) {
    return { season: top, method: "majority", agreement, includeInHeadline: true };
  }
  return { season: null, method: "unresolved", agreement, includeInHeadline: false };
}
