// Validation harness for the twelve-tone season engine.
//
//   node --experimental-strip-types --import ./scripts/register-alias.mjs \
//     scripts/validate-season.mjs
//
// Reports exact-match accuracy, family accuracy (Spring/Summer/Autumn/Winter),
// per-axis agreement and a confusion list, so regressions in the engine show up
// as a number rather than a vibe.
//
// READ THE PROVENANCE FIELD IN THE DATASET BEFORE QUOTING ANY NUMBER FROM THIS.

import { readFileSync } from "node:fs";
import { analyzeSeason } from "../src/lib/season.ts";

const raw = JSON.parse(
  readFileSync(new URL("../data/seasons/reference-archetypes.json", import.meta.url), "utf8"),
);
const cases = raw.cases;

const familyOf = (s) => s.split("-")[1];
const variantOf = (s) => s.split("-")[0];

let exact = 0;
let family = 0;
let variant = 0;
const confusion = [];
const perSeason = new Map();

for (const c of cases) {
  const r = analyzeSeason({ skin: c.skin, hair: c.hair, eye: c.eye });
  const okExact = r.season === c.expected;
  const okFamily = familyOf(r.season) === familyOf(c.expected);
  const okVariant = variantOf(r.season) === variantOf(c.expected);

  if (okExact) exact++;
  if (okFamily) family++;
  if (okVariant) variant++;

  const bucket = perSeason.get(c.expected) ?? { n: 0, hit: 0 };
  bucket.n++;
  if (okExact) bucket.hit++;
  perSeason.set(c.expected, bucket);

  if (!okExact) {
    confusion.push({
      id: c.id,
      expected: c.expected,
      got: r.season,
      dominant: r.dominant,
      conf: r.confidence,
      axes: `hue ${r.axes.hue.score.toFixed(2)}  value ${r.axes.value.score.toFixed(2)}  chroma ${r.axes.chroma.score.toFixed(2)}`,
      familyOk: okFamily,
    });
  }
}

const pct = (n) => `${((n / cases.length) * 100).toFixed(1)}%`;

console.log("=".repeat(72));
console.log("TWELVE-TONE SEASON ENGINE - REFERENCE ARCHETYPE AGREEMENT");
console.log("=".repeat(72));
console.log("Dataset : SYNTHETIC archetypes built from published season");
console.log("          descriptions. NOT measured people, NOT expert-labelled");
console.log("          photographs. This measures whether the engine reproduces");
console.log("          the textbook definition, and serves as a regression gate.");
console.log("-".repeat(72));
console.log(`cases                : ${cases.length}`);
console.log(`exact season match   : ${exact}/${cases.length}  ${pct(exact)}`);
console.log(`family match (4)     : ${family}/${cases.length}  ${pct(family)}   (Spring/Summer/Autumn/Winter)`);
console.log(`variant match (4)    : ${variant}/${cases.length}  ${pct(variant)}   (light/true/soft/bright/deep)`);

console.log("\nper-season exact match:");
for (const [season, b] of [...perSeason.entries()].sort()) {
  const bar = "#".repeat(b.hit) + ".".repeat(b.n - b.hit);
  console.log(`  ${season.padEnd(15)} ${b.hit}/${b.n}  ${bar}`);
}

if (confusion.length) {
  console.log(`\ndisagreements (${confusion.length}):`);
  for (const c of confusion) {
    console.log(`  ${c.id.padEnd(17)} expected ${c.expected.padEnd(14)} got ${c.got.padEnd(14)} ${c.familyOk ? "(family ok)" : "(FAMILY MISS)"}`);
    console.log(`  ${" ".repeat(17)} dominant=${c.dominant} conf=${c.conf}  ${c.axes}`);
  }
}

console.log("\n" + "=".repeat(72));
const target = 0.75;
const rate = exact / cases.length;
if (rate < target) {
  console.log(`RESULT: ${pct(exact)} exact vs ${target * 100}% target - engine needs work.`);
} else {
  console.log(`RESULT: ${pct(exact)} exact, at or above the ${target * 100}% gate.`);
}
console.log("=".repeat(72));
