// Occasion-stylist tool tests. Run with: npm test
//
// The model only plans; these tools produce every number a look shows and
// enforce the rules (real ids, no clashing colourway, within budget). Testing
// them is testing what the shopper can trust.

import {
  readScan,
  searchCatalog,
  rankColours,
  proposeLook,
  planWithoutModel,
  occasionFromBrief,
  budgetFromBrief,
} from "../src/lib/agent/tools.ts";
import { analyzeSkinTone } from "../src/lib/color.ts";
import { ALL_CONCERNS } from "../src/lib/skin.ts";
import { GARMENTS } from "../src/lib/fashion/products.ts";
import { rankColourwaysForSkin } from "../src/lib/fashion/styling.ts";

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

function profileWith(skinHex, redness = 85) {
  const scores = {};
  for (const k of ALL_CONCERNS) scores[k] = 85;
  scores.redness = redness;
  return {
    scores,
    skinAge: 28,
    skinType: "Normal",
    overall: 85,
    demo: true,
    capturedAt: new Date().toISOString(),
    tone: skinHex ? analyzeSkinTone(skinHex) : undefined,
  };
}

const warm = profileWith("#a0694b");
const flushed = profileWith("#a0694b", 60);
const untoned = profileWith(null);

// --- read_scan ---------------------------------------------------------------------
const scan = readScan(warm);
assert("read_scan returns the measured season", scan.ok && scan.data.season === warm.tone.seasonLabel);
assert("read_scan reports simulated concern scores honestly", scan.ok && scan.data.concern_scores_simulated === true);
assert("read_scan flags redness below the threshold", readScan(flushed).data.redness_flagged === true);
assert("read_scan does not flag healthy redness", scan.data.redness_flagged === false);
assert("read_scan refuses without a measured tone", readScan(untoned).ok === false);

// --- search_catalog ----------------------------------------------------------------
const outdoor = searchCatalog({ occasion: "outdoor", max_price: null });
assert("search filters by occasion", outdoor.ok && outdoor.data.every((g) => g.occasions.includes("outdoor")));
assert("search finds something for outdoor", outdoor.data.length > 0);
const cheap = searchCatalog({ occasion: null, max_price: 30 });
assert("search filters by max price", cheap.data.every((g) => g.price_usd <= 30));
assert("search rejects an unknown occasion", searchCatalog({ occasion: "gala", max_price: null }).ok === false);

// --- rank_colours ------------------------------------------------------------------
const ranked = rankColours(warm, { garment_id: "cotton-jacket" });
assert("rank_colours returns every colourway", ranked.ok && ranked.data.length === GARMENTS[0].colourways.length);
assert("rank_colours rejects an unknown garment", rankColours(warm, { garment_id: "nope" }).ok === false);
assert("rank_colours refuses without a tone", rankColours(untoned, { garment_id: "cotton-jacket" }).ok === false);

// --- propose_look ------------------------------------------------------------------
const best = rankColourwaysForSkin(warm, GARMENTS.find((g) => g.id === "cotton-jacket"))[0];
const good = proposeLook(warm, {
  headline: "Weekend look",
  note: "",
  budget_usd: 200,
  items: [{ garment_id: "cotton-jacket", colourway_id: best.colourway.id, why: "Easy layer." }],
});
assert("a valid look is accepted", good.ok === true);
assert("the server computes the total", good.ok && good.look.total === 96);
assert("fit and reason come from the ranking, not the model", good.ok && good.look.items[0].fit === best.fit && good.look.items[0].reason === best.reason);

const clashing = GARMENTS.flatMap((g) =>
  rankColourwaysForSkin(warm, g)
    .filter((r) => r.verdict === "clash")
    .map((r) => ({ g, r })),
)[0];
assert("the test palette has a clashing colourway to try", Boolean(clashing));
const rejectedClash = proposeLook(warm, {
  headline: "x",
  note: "",
  budget_usd: null,
  items: [{ garment_id: clashing.g.id, colourway_id: clashing.r.colourway.id, why: "" }],
});
assert("a clashing colourway is rejected", rejectedClash.ok === false && /clash/i.test(rejectedClash.error));

const over = proposeLook(warm, {
  headline: "x",
  note: "",
  budget_usd: 50,
  items: [{ garment_id: "cotton-jacket", colourway_id: best.colourway.id, why: "" }],
});
assert("a look over budget is rejected", over.ok === false && /budget/.test(over.error));
assert(
  "an invented garment is rejected",
  proposeLook(warm, { headline: "x", note: "", budget_usd: null, items: [{ garment_id: "kurta", colourway_id: "gold", why: "" }] }).ok === false,
);
assert(
  "an invented colourway is rejected",
  proposeLook(warm, { headline: "x", note: "", budget_usd: null, items: [{ garment_id: "cotton-jacket", colourway_id: "magenta", why: "" }] }).ok === false,
);
assert(
  "the same piece twice is rejected",
  proposeLook(warm, {
    headline: "x",
    note: "",
    budget_usd: null,
    items: [
      { garment_id: "cotton-jacket", colourway_id: best.colourway.id, why: "" },
      { garment_id: "cotton-jacket", colourway_id: best.colourway.id, why: "" },
    ],
  }).ok === false,
);
assert("an empty look is rejected", proposeLook(warm, { headline: "x", note: "", budget_usd: null, items: [] }).ok === false);

// --- brief parsing ---------------------------------------------------------------------
assert("hiking -> outdoor", occasionFromBrief("Hiking trip this weekend") === "outdoor");
assert("dinner -> evening", occasionFromBrief("Dinner date on Saturday") === "evening");
assert("interview -> smart-casual", occasionFromBrief("Job interview Monday") === "smart-casual");
assert("nothing specific -> everyday", occasionFromBrief("something to wear") === "everyday");
assert("$ budget is read", budgetFromBrief("under $150 please") === 150);
assert("worded budget is read", budgetFromBrief("budget of 120") === 120);
assert("rupee budget is not guessed into dollars", budgetFromBrief("under ₹4000") === null);
assert("no budget -> null", budgetFromBrief("a coffee date") === null);

// --- rules-only planner ------------------------------------------------------------------
const plan = planWithoutModel(warm, "Smart-casual brunch, under $130");
assert("planner returns a look", !("error" in plan));
assert("planner respects the budget", plan.total <= 130);
assert("planner labels itself as rules", plan.source === "rules");
assert("planner never picks a clashing colourway", plan.items.every((i) => i.verdict !== "clash"));
assert("planner keeps at most one outerwear layer", plan.items.filter((i) => GARMENTS.find((g) => g.id === i.garmentId).category === "Outerwear").length <= 1);
assert("planner records its tool trace", plan.trace.length >= 3 && plan.trace[0].tool === "read_scan");
assert(
  "an impossible budget is reported, not stretched",
  "error" in planWithoutModel(warm, "Dinner, under $10"),
);
assert("no tone -> planner reports why", "error" in planWithoutModel(untoned, "Dinner"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
