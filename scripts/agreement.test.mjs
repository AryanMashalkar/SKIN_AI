// Agreement-statistics tests. Run with: npm test
//
// Kappa is easy to implement subtly wrong, and a wrong ceiling would make every
// engine accuracy figure wrong too. These assert against hand-computable cases
// rather than against whatever the implementation happens to return.

import {
  cohensKappa,
  fleissKappa,
  seasonDistance,
  deriveConsensus,
  interpretKappa,
} from "../src/lib/agreement.ts";

let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}
const approx = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// --- Cohen's kappa against a hand-computed 2x2 ----------------------------
// 50 subjects, two categories:
//   both A = 20, both B = 15, rater1 A / rater2 B = 5, rater1 B / rater2 A = 10
//   p_o = 35/50 = 0.70
//   marginals: r1 A = 25/50 = 0.5, r2 A = 30/50 = 0.6
//   p_e = 0.5*0.6 + 0.5*0.4 = 0.50
//   kappa = (0.70 - 0.50) / (1 - 0.50) = 0.40
const A = "true-spring";
const B = "true-summer";
const r1 = [
  ...Array(20).fill(A), ...Array(15).fill(B),
  ...Array(5).fill(A), ...Array(10).fill(B),
];
const r2 = [
  ...Array(20).fill(A), ...Array(15).fill(B),
  ...Array(5).fill(B), ...Array(10).fill(A),
];
const ck = cohensKappa(r1, r2, { weighted: false });
assert("cohen: n = 50", ck.n === 50);
assert("cohen: observed agreement = 0.70", approx(ck.observed, 0.7, 1e-12));
assert("cohen: expected agreement = 0.50", approx(ck.expected, 0.5, 1e-12));
assert("cohen: kappa = 0.40", approx(ck.kappa, 0.4, 1e-12));
// Landis & Koch put 0.21-0.40 in the "fair" band, so kappa = 0.40 is fair,
// not moderate. Asserting the band boundary, not just the number.
assert("cohen: kappa 0.40 interpreted as 'fair'", ck.interpretation === "fair");
assert("cohen: just above 0.41 becomes 'moderate'", interpretKappa(0.45) === "moderate");

// Perfect and null agreement.
const same = [A, B, A, B, A];
assert("cohen: identical raters -> kappa 1", approx(cohensKappa(same, same, { weighted: false }).kappa, 1));
assert("cohen: empty input is safe", cohensKappa([], []).n === 0);
let threw = false;
try { cohensKappa([A], [A, B]); } catch { threw = true; }
assert("cohen: mismatched lengths throw", threw);

// Single-category input: chance explains everything, kappa is undefined -> 0.
assert("cohen: degenerate single-category -> kappa 0",
  cohensKappa([A, A, A], [A, A, A], { weighted: false }).kappa === 0);

// --- Weighted vs unweighted -----------------------------------------------
// Near-miss disagreements must score better than opposite ones. This is the
// whole reason weighting exists: unweighted kappa calls both "just wrong".
const truth = [A, A, A, A];
const nearMiss = ["light-spring", "light-spring", "light-spring", "light-spring"];
const opposite = ["deep-winter", "deep-winter", "deep-winter", "deep-winter"];
const wNear = cohensKappa(truth, nearMiss, { weighted: true });
const wFar = cohensKappa(truth, opposite, { weighted: true });
assert("weighted: near-miss scores higher than opposite", wNear.observed > wFar.observed);
assert("weighted: unweighted treats both identically",
  cohensKappa(truth, nearMiss, { weighted: false }).observed ===
    cohensKappa(truth, opposite, { weighted: false }).observed);

// --- Season distance ordering ---------------------------------------------
assert("distance: identical seasons = 0", seasonDistance(A, A) === 0);
assert("distance: symmetric",
  seasonDistance("true-spring", "deep-winter") === seasonDistance("deep-winter", "true-spring"));
assert("distance: opposite corners = 1", seasonDistance("true-spring", "deep-winter") === 1);
assert("distance: same family variant miss is smallest",
  seasonDistance("true-spring", "light-spring") < seasonDistance("true-spring", "true-autumn"));
assert("distance: same-hue family miss < hue flip",
  seasonDistance("true-spring", "true-autumn") < seasonDistance("light-spring", "light-summer"));
assert("distance: all pairs within [0,1]", [
  "light-spring", "true-spring", "bright-spring", "light-summer", "true-summer",
  "soft-summer", "soft-autumn", "true-autumn", "deep-autumn", "true-winter",
  "deep-winter", "bright-winter",
].every((x, _i, all) => all.every((y) => {
  const d = seasonDistance(x, y);
  return d >= 0 && d <= 1;
})));

// --- Fleiss' kappa --------------------------------------------------------
// Perfect agreement, two categories evenly split: P_bar = 1, P_e = 0.5 -> 1.0
assert("fleiss: perfect agreement -> kappa 1",
  approx(fleissKappa([[A, A], [A, A], [B, B], [B, B]]).kappa, 1, 1e-12));
// Maximal disagreement: every subject split -> P_bar = 0, P_e = 0.5 -> -1.0
assert("fleiss: total disagreement -> kappa -1",
  approx(fleissKappa([[A, B], [A, B], [A, B], [A, B]]).kappa, -1, 1e-12));
assert("fleiss: empty input is safe", fleissKappa([]).n === 0);
let threw2 = false;
try { fleissKappa([[A, B], [A]]); } catch { threw2 = true; }
assert("fleiss: ragged rating counts throw", threw2);
let threw3 = false;
try { fleissKappa([[A], [B]]); } catch { threw3 = true; }
assert("fleiss: fewer than 2 raters throws", threw3);

// --- Consensus derivation -------------------------------------------------
const unanimous = deriveConsensus([A, A, A]);
assert("consensus: unanimous is recognised", unanimous.method === "unanimous");
assert("consensus: unanimous is scorable", unanimous.includeInHeadline === true);
assert("consensus: unanimous agreement = 1", unanimous.agreement === 1);

const majority = deriveConsensus([A, A, B]);
assert("consensus: majority is recognised", majority.method === "majority");
assert("consensus: majority picks the plurality", majority.season === A);
assert("consensus: majority is scorable", majority.includeInHeadline === true);

// A 50/50 split must NOT be silently promoted to a label.
const split = deriveConsensus([A, B]);
assert("consensus: tie is unresolved", split.method === "unresolved");
assert("consensus: tie has no season", split.season === null);
assert("consensus: tie is excluded from headline", split.includeInHeadline === false);

// Three-way split with no majority is also unresolved, not plurality-promoted.
const plurality = deriveConsensus([A, B, "soft-autumn", "deep-winter"]);
assert("consensus: plurality without majority stays unresolved",
  plurality.method === "unresolved" && plurality.season === null);

// Adjudication resolves a tie, and is recorded as such.
const adjudicated = deriveConsensus([A, B], "true-autumn");
assert("consensus: adjudication resolves a tie", adjudicated.method === "adjudicated");
assert("consensus: adjudicated label is used", adjudicated.season === "true-autumn");
assert("consensus: adjudicated is scorable", adjudicated.includeInHeadline === true);
assert("consensus: empty ratings unresolved", deriveConsensus([]).method === "unresolved");

// --- Interpretation bands -------------------------------------------------
assert("interpret: negative is worse than chance", interpretKappa(-0.1) === "worse than chance");
assert("interpret: 0.5 is moderate", interpretKappa(0.5) === "moderate");
assert("interpret: 0.9 is almost perfect", interpretKappa(0.9) === "almost perfect");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
