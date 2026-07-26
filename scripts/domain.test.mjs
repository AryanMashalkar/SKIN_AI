// Domain-logic tests: routine construction, progress deltas, recency.
// Run with: npm test

import {
  buildRoutine,
  routineProducts,
  rankProducts,
  bestValuePick,
} from "../src/lib/matching.ts";
import {
  ALL_CONCERNS,
  progressBetween,
  meaningfulDeltas,
  daysSince,
  isRescanDue,
} from "../src/lib/skin.ts";

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

function makeProfile(overrides = {}, capturedAt = new Date().toISOString()) {
  const scores = {};
  for (const k of ALL_CONCERNS) scores[k] = overrides[k] ?? 80;
  return {
    scores,
    skinAge: 30,
    skinType: "Normal",
    overall: 80,
    demo: false,
    capturedAt,
  };
}

// --- routine ---------------------------------------------------------------
const dry = makeProfile({ moisture: 45, redness: 60, radiance: 62 });
const complete = buildRoutine(dry, "complete");
const starter = buildRoutine(dry, "starter");

assert("complete routine has AM steps", complete.am.length > 0);
assert("complete routine has PM steps", complete.pm.length > 0);
assert(
  "AM ends with SPF (protect last)",
  complete.am[complete.am.length - 1].slot === "Protect",
);
assert("AM starts with Cleanse", complete.am[0].slot === "Cleanse");
assert("PM has no SPF", complete.pm.every((s) => s.slot !== "Protect"));
assert(
  "starter is no larger than complete",
  routineProducts(starter).length <= routineProducts(complete).length,
);
assert("starter total <= complete total", starter.total <= complete.total);
assert(
  "routine total equals sum of unique products",
  complete.total ===
    routineProducts(complete).reduce((s, p) => s + p.price, 0),
);
assert(
  "routineProducts de-duplicates shared steps",
  new Set(routineProducts(complete).map((p) => p.id)).size ===
    routineProducts(complete).length,
);

// --- matching evidence -----------------------------------------------------
const ranked = rankProducts(dry);
assert("ranked results carry evidence", Array.isArray(ranked[0].evidence));
assert(
  "evidence scores match the profile",
  ranked[0].evidence.every((e) => e.score === dry.scores[e.key]),
);

// --- best value ------------------------------------------------------------
const value = bestValuePick(dry);
assert("best-value pick exists", value !== null);
assert(
  "best-value targets the worst concern",
  value.product.concerns.includes("moisture"),
);

// --- progress --------------------------------------------------------------
const before = makeProfile({ moisture: 50, redness: 70 });
const after = makeProfile({ moisture: 62, redness: 71 });
const deltas = progressBetween(before, after);
const moisture = deltas.find((d) => d.key === "moisture");
assert("moisture delta computed", moisture.delta === 12);
assert("deltas sorted by magnitude", Math.abs(deltas[0].delta) >= Math.abs(deltas[1].delta));
assert(
  "meaningfulDeltas filters noise (<3)",
  meaningfulDeltas(before, after).every((d) => Math.abs(d.delta) >= 3),
);
assert(
  "1-point redness change is filtered out",
  !meaningfulDeltas(before, after).some((d) => d.key === "redness"),
);

// --- recency ---------------------------------------------------------------
const old = makeProfile({}, new Date(Date.now() - 30 * 86400000).toISOString());
const fresh = makeProfile({});
assert("daysSince ~30 for a month-old scan", daysSince(old) >= 29);
assert("rescan due after 28 days", isRescanDue(old) === true);
assert("rescan not due for a fresh scan", isRescanDue(fresh) === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
