// Colourway ranking tests. Run with: npm test

import {
  deltaE,
  colourTemp,
  rankColourways,
  GOOD_DELTA_E,
  CLASH_DELTA_E,
  REDNESS_PENALTY,
} from "../src/lib/fashion/colourways.ts";
import { seasonDef, rgbToLab, hexToRgb, analyzeSkinTone } from "../src/lib/color.ts";
import { GARMENTS } from "../src/lib/fashion/products.ts";
import { remapLightness } from "../src/lib/fashion/lightness.ts";
import { proofForSkin, rankColourwaysForSkin } from "../src/lib/fashion/styling.ts";
import { fromGarment } from "../src/lib/cart.ts";
import { ALL_CONCERNS } from "../src/lib/skin.ts";

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

const lab = (hex) => rgbToLab(hexToRgb(hex));

// --- deltaE ----------------------------------------------------------------
assert("deltaE of a colour with itself is 0", deltaE(lab("#7a2f2f"), lab("#7a2f2f")) === 0);
assert("deltaE is symmetric", deltaE(lab("#123456"), lab("#abcdef")) === deltaE(lab("#abcdef"), lab("#123456")));
assert("black vs white is ~100", Math.abs(deltaE(lab("#000000"), lab("#ffffff")) - 100) < 0.5);

// --- fabric temperature ----------------------------------------------------
assert("khaki is warm", colourTemp("#c4a27a") === "warm");
assert("rust is warm", colourTemp("#a8481f") === "warm");
assert("mustard is warm", colourTemp("#c99a2e") === "warm");
assert("navy is cool", colourTemp("#1f2a4a") === "cool");
assert("royal blue is cool", colourTemp("#12428a") === "cool");
assert("purple is cool", colourTemp("#4b2a7a") === "cool");
assert("mid grey is neutral", colourTemp("#808080") === "neutral");
assert("black is neutral", colourTemp("#1e1e1e") === "neutral");
assert("white is neutral", colourTemp("#f4f4f2") === "neutral");

// --- ranking ---------------------------------------------------------------
const deepAutumn = seasonDef("deep-autumn").palette;
const ways = [
  { id: "icy", name: "icy lilac", hex: "#d8d0f0" },
  { id: "choc", name: "chocolate", hex: "#5c3b2b" },
  { id: "rust", name: "rust", hex: "#9a4a2a" },
  { id: "navy", name: "navy", hex: "#1f2a4a" },
];
const ranked = rankColourways(ways, deepAutumn);

assert("returns one entry per colourway", ranked.length === ways.length);
assert("sorted by fit, best first", ranked.every((r, i) => i === 0 || ranked[i - 1].fit >= r.fit));
assert("fit stays within 0-100", ranked.every((r) => r.fit >= 0 && r.fit <= 100));
assert("Deep Autumn: chocolate ranks first", ranked[0].colourway.id === "choc");
assert("Deep Autumn: chocolate is the best pick", ranked[0].verdict === "best");
assert("Deep Autumn: icy lilac ranks last", ranked[ranked.length - 1].colourway.id === "icy");
assert("Deep Autumn: icy lilac clashes", ranked[ranked.length - 1].verdict === "clash");
assert("only one colourway is marked best", ranked.filter((r) => r.verdict === "best").length <= 1);
assert(
  "verdicts agree with the ΔE thresholds",
  ranked.every((r) =>
    r.verdict === "clash"
      ? r.deltaE >= CLASH_DELTA_E
      : r.verdict === "workable"
        ? r.deltaE > GOOD_DELTA_E && r.deltaE < CLASH_DELTA_E
        : r.deltaE <= GOOD_DELTA_E,
  ),
);
assert("reason names the nearest palette colour", ranked.every((r) => r.reason.includes(r.nearest.name)));
assert("reason quotes the measured ΔE", ranked[0].reason.includes(`ΔE ${Math.round(ranked[0].deltaE)}`));

const trueSummer = rankColourways(ways, seasonDef("true-summer").palette);
assert("True Summer does not pick chocolate first", trueSummer[0].colourway.id !== "choc");

assert("no palette -> no verdicts (never invented)", rankColourways(ways, []).length === 0);
assert("no colourways -> empty", rankColourways([], deepAutumn).length === 0);

// --- today's skin: redness ---------------------------------------------------
const calm = rankColourways(ways, deepAutumn).find((r) => r.colourway.id === "rust");
const flushed = rankColourways(ways, deepAutumn, { rednessElevated: true }).find(
  (r) => r.colourway.id === "rust",
);
assert("redness lowers a red colourway's fit", flushed.fit === Math.max(0, calm.fit - REDNESS_PENALTY));
assert("a red colourway is never 'best' when redness is flagged", flushed.verdict !== "best" && flushed.verdict !== "good");
assert("redness is explained in the reason", /redness/i.test(flushed.reason));
const navyCalm = rankColourways(ways, deepAutumn).find((r) => r.colourway.id === "navy");
const navyFlushed = rankColourways(ways, deepAutumn, { rednessElevated: true }).find(
  (r) => r.colourway.id === "navy",
);
assert("redness leaves non-red colourways alone", navyCalm.fit === navyFlushed.fit);

// --- catalogue integrity -----------------------------------------------------
assert("every garment has at least one colourway", GARMENTS.every((g) => g.colourways.length >= 1));
assert(
  "every garment's first colourway is the photographed original",
  GARMENTS.every((g) => g.colourways[0].original === true),
);
assert(
  "exactly one original colourway per garment",
  GARMENTS.every((g) => g.colourways.filter((c) => c.original).length === 1),
);
assert(
  "the garment swatch matches its original colourway",
  GARMENTS.every((g) => g.swatch === g.colourways[0].hex),
);
assert(
  "the hand-labelled warmth agrees with the measured swatch temperature",
  GARMENTS.every((g) => g.warmth === colourTemp(g.swatch)),
);
assert(
  "colourway ids are unique within each garment",
  GARMENTS.every((g) => new Set(g.colourways.map((c) => c.id)).size === g.colourways.length),
);

// --- lightness remap (recolouring) -------------------------------------------
assert("garment mean lands on the darker target", Math.abs(remapLightness(0.6, 0.6, 0.2) - 0.2) < 1e-9);
assert("garment mean lands on the lighter target", Math.abs(remapLightness(0.3, 0.3, 0.8) - 0.8) < 1e-9);
assert("darkening keeps folds darker than highlights", remapLightness(0.4, 0.6, 0.2) < remapLightness(0.8, 0.6, 0.2));
assert("lightening keeps folds darker than highlights", remapLightness(0.2, 0.3, 0.8) < remapLightness(0.4, 0.3, 0.8));
assert(
  "darkening does not crush a shadow to the floor",
  remapLightness(0.3, 0.6, 0.2) > 0.05,
);
assert("output is clamped to a printable range", [0, 0.5, 1].every((l) => {
  const v = remapLightness(l, 0.5, 0.99);
  return v >= 0.02 && v <= 0.97;
}));

// --- proof shot ----------------------------------------------------------------
function profileWith(skinHex, redness = 85) {
  const scores = {};
  for (const k of ALL_CONCERNS) scores[k] = 85;
  scores.redness = redness;
  return {
    scores,
    skinAge: 28,
    skinType: "Normal",
    overall: 85,
    demo: false,
    capturedAt: new Date().toISOString(),
    tone: analyzeSkinTone(skinHex),
  };
}

const warmDeep = profileWith("#8d5a3c");
const proof = proofForSkin(warmDeep, GARMENTS);
assert("proof is chosen when a tone was measured", proof !== null);
assert("proof garment has several colourways", proof.garment.colourways.length > 1);
assert("proof garment is not lower-body", proof.garment.garmentCategory !== "lower_body");
assert("proof 'best' is that garment's top-ranked colourway", proof.best.colourway.id === rankColourwaysForSkin(warmDeep, proof.garment)[0].colourway.id);
assert("proof compares two different colourways", proof.best.colourway.id !== proof.contrast.colourway.id);
assert("our pick fits at least as well as the contrast", proof.best.fit >= proof.contrast.fit);
assert(
  "an as-pictured contrast really is the photographed colour",
  proof.contrastIs !== "as-pictured" || proof.contrast.colourway.original === true,
);
assert(
  "an as-pictured garment is preferred when one exists",
  proof.contrastIs === "as-pictured" ||
    GARMENTS.every((g) => {
      const r = rankColourwaysForSkin(warmDeep, g);
      return r.length < 2 || r[0].colourway.original;
    }),
);

const untoned = { ...warmDeep, tone: undefined };
assert("no measured tone -> no proof (never invented)", proofForSkin(untoned, GARMENTS) === null);
assert("no measured tone -> colourways unranked", rankColourwaysForSkin(untoned, GARMENTS[0]).length === 0);

// --- cart: one line per colourway ----------------------------------------------
const jacket = GARMENTS.find((g) => g.colourways.length > 1);
const [orig, alt] = jacket.colourways;
assert("photographed colour keeps the plain garment id", fromGarment(jacket, orig).id === jacket.id);
assert("a recoloured colourway gets its own cart id", fromGarment(jacket, alt).id === `${jacket.id}:${alt.id}`);
assert("cart name says which colour", fromGarment(jacket, alt).name.includes(alt.name));
assert("no colourway -> unchanged legacy item", fromGarment(jacket).id === jacket.id && fromGarment(jacket).name === jacket.name);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
