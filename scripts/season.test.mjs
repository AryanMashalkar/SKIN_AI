// Twelve-tone season engine tests. Run with: npm test
//
// Covers the module that actually produces the product's output. The original
// `classifySeason` shipped with zero assertions while the copied CIELAB matrix
// had eighteen; this exists so that mistake is not repeated.

import {
  analyzeSeason,
  analyzeAppearance,
} from "../src/lib/season.ts";
import { deriveStyleProfile } from "../src/lib/fashion/styling.ts";
import { mockSkinProfile } from "../src/lib/mock.ts";
import { readFileSync } from "node:fs";
import { hexToRgb } from "../src/lib/color.ts";
import { nearestOption } from "../src/lib/appearance-sample.ts";
import { HAIR_OPTIONS, EYE_OPTIONS } from "../src/lib/appearance-options.ts";

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

const SKIN = "#e8beac";

// --- The core claim: hair and eye colour change the answer ----------------
// Skin-only classification cannot distinguish these four people. That was the
// defect this module was built to fix, so it is asserted first.
const platinum = analyzeSeason({ skin: SKIN, hair: "#e8ddc9", eye: "#a8c4d4" });
const raven = analyzeSeason({ skin: SKIN, hair: "#1c1614", eye: "#2b1f1a" });
const ashy = analyzeSeason({ skin: SKIN, hair: "#6b5a4e", eye: "#8a8f8c" });
const copper = analyzeSeason({ skin: SKIN, hair: "#a5502a", eye: "#7a8f5a" });

assert("same skin + different hair/eye -> different seasons",
  new Set([platinum.season, raven.season, ashy.season, copper.season]).size >= 3);
assert("platinum blonde + blue eyes -> a Summer", platinum.season.endsWith("summer"));
assert("black hair + black eyes -> a Winter", raven.season.endsWith("winter"));
assert("copper hair + green eyes -> warm family",
  copper.season.endsWith("spring") || copper.season.endsWith("autumn"));
assert("light colouring reads lighter than raven colouring",
  platinum.axes.value.score > raven.axes.value.score);

// --- Regression: golden blonde must read WARM ------------------------------
// A first implementation used hue ANGLE for pigment warmth, which classified a
// b*=+22 golden blonde as cool because its a* is near zero and the angle swings.
// b* IS the yellow-blue axis; this guards the fix.
const goldenBlonde = analyzeSeason({ skin: "#f0c8a0", hair: "#d9b26a", eye: "#8a5a2b" });
assert("golden blonde + amber eyes reads warm", goldenBlonde.axes.hue.score > 0);
assert("golden blonde + amber eyes -> warm season",
  goldenBlonde.season.endsWith("spring") || goldenBlonde.season.endsWith("autumn"));

const ashBlonde = analyzeSeason({ skin: SKIN, hair: "#cfc0a8", eye: "#a3bccd" });
assert("ash blonde reads cooler than golden blonde",
  ashBlonde.axes.hue.score < goldenBlonde.axes.hue.score);

// --- Regression: black hair must not force "soft" --------------------------
// Averaging hair chroma into the clarity term dragged every high-contrast
// Winter toward soft, despite Bright Winter being DEFINED by black hair against
// light skin. Saturation is now read from skin+eye only, with contrast leading.
const brightWinter = analyzeSeason({ skin: "#f0d2c2", hair: "#1e1917", eye: "#2f9fc4" });
assert("black hair + light skin + vivid eyes is not soft",
  brightWinter.axes.chroma.score > 0);
assert("extreme contrast -> Bright Winter", brightWinter.season === "bright-winter");

// --- Skin-only fallback is valid but explicitly weaker ----------------------
const skinOnly = analyzeSeason({ skin: SKIN });
assert("skin-only still returns a season", typeof skinOnly.season === "string");
assert("skin-only reports no hair/eye", !skinOnly.inputs.hair && !skinOnly.inputs.eye);
assert("skin-only confidence is low", skinOnly.confidence < 0.6);
assert("skin-only confidence < full reading", skinOnly.confidence < platinum.confidence);
assert("skin-only never lets chroma dominate", skinOnly.dominant !== "chroma");
assert("skin-only explains why it is uncertain",
  skinOnly.reasoning.some((r) => r.toLowerCase().includes("skin only")));

const skinPlusHair = analyzeSeason({ skin: SKIN, hair: "#1c1614" });
assert("adding hair raises confidence", skinPlusHair.confidence > skinOnly.confidence);
assert("adding eye on top raises confidence further",
  raven.confidence > skinPlusHair.confidence);

// --- Confidence is bounded and never certain -------------------------------
const many = [platinum, raven, ashy, copper, goldenBlonde, brightWinter, skinOnly];
assert("confidence never exceeds 0.88", many.every((r) => r.confidence <= 0.88));
assert("confidence never negative", many.every((r) => r.confidence >= 0));
assert("axis scores stay within [-1, 1]", many.every((r) =>
  ["hue", "value", "chroma"].every((a) => r.axes[a].score >= -1 && r.axes[a].score <= 1)));
assert("dominant axis is one of the three",
  many.every((r) => ["hue", "value", "chroma"].includes(r.dominant)));
assert("every reading explains itself",
  many.every((r) => Array.isArray(r.reasoning) && r.reasoning.length >= 4));

// --- All twelve seasons remain reachable -----------------------------------
const ALL_SEASONS = [
  "light-spring", "true-spring", "bright-spring",
  "light-summer", "true-summer", "soft-summer",
  "soft-autumn", "true-autumn", "deep-autumn",
  "true-winter", "deep-winter", "bright-winter",
];
const reached = new Set();
const HAIRS = ["#1c1614", "#3b2a1e", "#6b4a30", "#6b5a4e", "#8a4b23", "#a5502a", "#d9b26a", "#cfc0a8", "#e8ddc9", "#9a9691"];
const EYES = ["#2b1f1a", "#5a3a22", "#8a5a2b", "#8a7f56", "#7a8f5a", "#6a9ec4", "#a8c4d4", "#8a8f8c"];
const SKINS = ["#fadfc4", "#f0c8a0", "#e8beac", "#d9a679", "#c68642", "#a9714f", "#8d5524", "#6b4433", "#4a3223"];
for (const s of SKINS) for (const h of HAIRS) for (const e of EYES) {
  reached.add(analyzeSeason({ skin: s, hair: h, eye: e }).season);
}
for (const s of ALL_SEASONS) {
  assert(`season "${s}" reachable from real colouring`, reached.has(s));
}

// --- Deep skin is not collapsed --------------------------------------------
// The original engine hardcoded every warm deep-skinned user to "deep-autumn".
const deepSeasons = new Set();
for (const h of HAIRS) for (const e of EYES) {
  deepSeasons.add(analyzeSeason({ skin: "#8d5524", hair: h, eye: e }).season);
}
assert(`deep skin spans multiple seasons (got ${deepSeasons.size})`, deepSeasons.size >= 3);

// --- analyzeAppearance returns a usable SkinTone ---------------------------
const tone = analyzeAppearance({ skin: "#c68642", hair: "#3b2a1e", eye: "#5a3a22" });
assert("analyzeAppearance returns 6 palette colours", tone.palette.length === 6);
assert("palette entries are hex", tone.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex)));
assert("carries the analysis through", !!tone.analysis);
assert("ITA stays a SKIN measurement", Number.isFinite(tone.ita));
assert("season label is non-empty", typeof tone.seasonLabel === "string" && tone.seasonLabel.length > 0);
assert("hex echoes the skin input", tone.hex === "#c68642");

// --- Styling consumes the three-axis hue, not skin undertone ---------------
// Regression: skin's b*-a* gap reads "neutral" on most people, which collapsed
// genuinely cool/warm users to "balanced" and discarded the hair/eye signal.
function styleFor(features) {
  return deriveStyleProfile({ ...mockSkinProfile(), tone: analyzeAppearance(features) }).recommend;
}
assert("black hair + black eyes -> cool styling",
  styleFor({ skin: SKIN, hair: "#1c1614", eye: "#2b1f1a" }) === "cool");
assert("golden blonde + amber eyes -> warm styling",
  styleFor({ skin: "#f0c8a0", hair: "#d9b26a", eye: "#8a5a2b" }) === "warm");
assert("copper + green -> warm styling",
  styleFor({ skin: SKIN, hair: "#a5502a", eye: "#7a8f5a" }) === "warm");

// --- Reference archetype agreement gate ------------------------------------
// Guards the calibrated parameters. NOT a validity claim: the archetypes are
// synthetic. See data/seasons/README.md.
const raw = JSON.parse(
  readFileSync(new URL("../data/seasons/reference-archetypes.json", import.meta.url), "utf8"),
);
let exact = 0;
let family = 0;
for (const c of raw.cases) {
  const got = analyzeSeason({ skin: c.skin, hair: c.hair, eye: c.eye }).season;
  if (got === c.expected) exact++;
  if (got.split("-")[1] === c.expected.split("-")[1]) family++;
}
assert(`archetype exact agreement >= 17/24 (got ${exact})`, exact >= 17);
assert(`archetype family agreement >= 22/24 (got ${family})`, family >= 22);

// --- Auto-detection snapping (pure part of the MediaPipe sampler) ----------
// Noisy CV output is quantised to a known pigment option, so classification
// only ever sees sane values. Detection SUGGESTS; the user is the source of
// truth. These assert the snapping does not send a colour to the wrong family.
const toRgb = (hex) => hexToRgb(hex);

assert("black hair sample snaps to a dark option",
  ["black", "dark-brown"].includes(nearestOption(toRgb("#191310"), HAIR_OPTIONS).id));
assert("golden hair sample snaps to golden blonde",
  nearestOption(toRgb("#d8b06c"), HAIR_OPTIONS).id === "golden-blonde");
assert("copper hair sample snaps to auburn or copper",
  ["auburn", "copper"].includes(nearestOption(toRgb("#a04e2b"), HAIR_OPTIONS).id));
assert("grey hair sample snaps to grey or platinum",
  ["grey", "platinum"].includes(nearestOption(toRgb("#9b9792"), HAIR_OPTIONS).id));
assert("blue iris sample snaps to a blue option",
  nearestOption(toRgb("#6b9fc6"), EYE_OPTIONS).id.includes("blue"));
assert("dark iris sample snaps to a brown option",
  nearestOption(toRgb("#2c201b"), EYE_OPTIONS).id.includes("brown"));
assert("green iris sample snaps to green",
  nearestOption(toRgb("#7b8f5b"), EYE_OPTIONS).id === "green");
assert("snapping always returns a catalogued option",
  HAIR_OPTIONS.some((o) => o.id === nearestOption(toRgb("#123456"), HAIR_OPTIONS).id));

// A detected swatch must feed the engine identically to a manually picked one.
const detectedHair = nearestOption(toRgb("#d8b06c"), HAIR_OPTIONS);
const detectedEye = nearestOption(toRgb("#8b5b2c"), EYE_OPTIONS);
assert("detected swatches drive the same warm result as manual ones",
  analyzeSeason({ skin: "#f0c8a0", hair: detectedHair.hex, eye: detectedEye.hex })
    .axes.hue.score > 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
