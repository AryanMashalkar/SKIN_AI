// Inter-rater agreement + engine accuracy against expert labels.
//
//   npm run agreement
//
// Deliberately ordered: the human-vs-human ceiling is computed and printed
// FIRST, and the engine score is reported relative to it. An engine accuracy
// figure without that ceiling is uninterpretable - 70% could be at human level
// or far below it, and the number alone cannot tell you which.

import { readFileSync } from "node:fs";
import {
  cohensKappa,
  fleissKappa,
  deriveConsensus,
  seasonDistance,
} from "../src/lib/agreement.ts";
import { analyzeSeason } from "../src/lib/season.ts";

// An alternate dataset path may be passed as argv[2], which keeps the
// populated code path exercisable without seeding fake subjects into the real
// file. Fabricated rows in the real dataset would be indistinguishable from
// expert labels later, which is exactly the failure this project already had
// once with mock skin scores.
const dataPath = process.argv[2]
  ? new URL(`file://${process.argv[2].replace(/\\/g, "/")}`)
  : new URL("../data/seasons/labelled-photos.json", import.meta.url);

// Strip a UTF-8 BOM before parsing: this file will be hand-edited by
// collaborators, and Windows editors add one silently, which makes JSON.parse
// fail with an opaque "Unexpected token" error.
const data = JSON.parse(readFileSync(dataPath, "utf8").replace(/^\uFEFF/, ""));
const subjects = data.subjects ?? [];

const line = (c = "=") => console.log(c.repeat(72));
const pct = (v) => `${(v * 100).toFixed(1)}%`;

line();
console.log("SEASON LABELLING - AGREEMENT & ENGINE ACCURACY");
line();

if (subjects.length === 0) {
  console.log("No labelled subjects yet.\n");
  console.log("This pipeline is built and tested; it is waiting on data.");
  console.log("Populate data/seasons/labelled-photos.json following the");
  console.log("protocol block in that file, then re-run.\n");
  console.log(`  target subjects   : ${data.protocol?.targetSubjects ?? "?"}`);
  console.log(`  overlap for kappa : ${data.protocol?.overlapSubjects ?? "?"} (rated by 2+ analysts)`);
  console.log("\nUntil then the defensible public claim is the one in");
  console.log("data/seasons/README.md - reproduces the published definition on");
  console.log("reference archetypes; agreement with human analysts NOT measured.");
  line();
  process.exit(0);
}

// ---- 1. inter-rater agreement (the ceiling) -------------------------------

const overlap = subjects.filter((s) => (s.ratings ?? []).length >= 2);
console.log(`subjects total            : ${subjects.length}`);
console.log(`subjects with 2+ ratings  : ${overlap.length}`);

if (overlap.length < 20) {
  console.log("\n!! Fewer than 20 overlapping subjects.");
  console.log("!! Kappa over 12 categories is unstable at this size - treat any");
  console.log("!! value below as indicative only, not as a measured ceiling.");
}

let ceiling = null;

if (overlap.length > 0) {
  const raterCounts = new Set(overlap.map((s) => s.ratings.length));
  line("-");
  console.log("INTER-RATER AGREEMENT (the ceiling on any engine score)");
  line("-");

  if (raterCounts.size === 1 && [...raterCounts][0] === 2) {
    const a = overlap.map((s) => s.ratings[0].season);
    const b = overlap.map((s) => s.ratings[1].season);
    const plain = cohensKappa(a, b, { weighted: false });
    const weighted = cohensKappa(a, b, { weighted: true });

    console.log(`Cohen's kappa, unweighted : ${plain.kappa.toFixed(3)}  (${plain.interpretation})`);
    console.log(`  raw agreement           : ${pct(plain.observed)}`);
    console.log(`Cohen's kappa, WEIGHTED   : ${weighted.kappa.toFixed(3)}  (${weighted.interpretation})`);
    console.log(`  weighted agreement      : ${pct(weighted.observed)}`);
    console.log("\n  Weighted is the honest headline: the twelve seasons are");
    console.log("  structured on hue/value/chroma, so True Spring vs Light");
    console.log("  Spring is a near miss while True Spring vs Deep Winter is");
    console.log("  a total one. Unweighted kappa scores them identically.");
    ceiling = plain.observed;
  } else {
    const uniform = [...raterCounts].length === 1;
    if (!uniform) {
      console.log("Ratings per subject vary; Fleiss' kappa needs a uniform count.");
      console.log("Truncating each subject to its first N ratings for this run.");
    }
    const n = Math.min(...raterCounts);
    const f = fleissKappa(overlap.map((s) => s.ratings.slice(0, n).map((r) => r.season)));
    console.log(`Fleiss' kappa (${n} raters)  : ${f.kappa.toFixed(3)}  (${f.interpretation})`);
    console.log(`  raw agreement           : ${pct(f.observed)}`);
    ceiling = f.observed;
  }
}

// ---- 2. consensus health --------------------------------------------------

line("-");
console.log("CONSENSUS");
line("-");
const consensuses = subjects.map((s) => ({
  s,
  c: deriveConsensus((s.ratings ?? []).map((r) => r.season), s.adjudicated ?? null),
}));
const byMethod = {};
for (const { c } of consensuses) byMethod[c.method] = (byMethod[c.method] ?? 0) + 1;
for (const [m, n] of Object.entries(byMethod)) {
  console.log(`  ${m.padEnd(12)} ${n}`);
}
const scorable = consensuses.filter((x) => x.c.includeInHeadline && x.c.season);
const excluded = subjects.length - scorable.length;
console.log(`\n  scorable      ${scorable.length}`);
console.log(`  excluded      ${excluded}  (unresolved - retained, never deleted)`);
if (excluded / subjects.length > 0.2) {
  console.log("\n  !! Over 20% excluded. These are the HARD cases; a headline");
  console.log("  !! accuracy computed without them is optimistically biased.");
  console.log("  !! Report the exclusion rate alongside any accuracy figure.");
}

// ---- 3. engine vs consensus ----------------------------------------------

line("-");
console.log("ENGINE vs EXPERT CONSENSUS");
line("-");

if (scorable.length === 0) {
  console.log("No scorable subjects.");
  line();
  process.exit(0);
}

let exact = 0;
let family = 0;
let weightedScore = 0;
const confusion = [];

for (const { s, c } of scorable) {
  const m = s.measured ?? {};
  if (!m.skin) continue;
  const got = analyzeSeason({ skin: m.skin, hair: m.hair, eye: m.eye }).season;
  if (got === c.season) exact++;
  if (got.split("-")[1] === c.season.split("-")[1]) family++;
  weightedScore += 1 - seasonDistance(got, c.season);
  if (got !== c.season) confusion.push({ id: s.id, expected: c.season, got });
}

const exactRate = exact / scorable.length;
console.log(`exact season match  : ${exact}/${scorable.length}  ${pct(exactRate)}`);
console.log(`family match        : ${family}/${scorable.length}  ${pct(family / scorable.length)}`);
console.log(`distance-weighted   : ${pct(weightedScore / scorable.length)}`);

if (ceiling !== null) {
  console.log(`\nhuman-vs-human raw agreement : ${pct(ceiling)}   <- the ceiling`);
  const ratio = exactRate / ceiling;
  console.log(`engine / ceiling             : ${pct(ratio)}`);
  if (ratio >= 0.95) {
    console.log("\n  Engine is at or near human level. Further gains are likely");
    console.log("  chasing label noise rather than real error.");
  } else if (ratio >= 0.8) {
    console.log("\n  Engine is approaching human level; real headroom remains.");
  } else {
    console.log("\n  Engine is materially below human level - real headroom.");
  }
}

if (confusion.length) {
  console.log(`\ndisagreements (${confusion.length}):`);
  for (const c of confusion.slice(0, 25)) {
    console.log(`  ${String(c.id).padEnd(14)} expert ${c.expected.padEnd(14)} engine ${c.got}`);
  }
  if (confusion.length > 25) console.log(`  ... and ${confusion.length - 25} more`);
}
line();
