// Color-engine sanity tests. Run with: npm test
// Pure assertions against the CIELAB / ITA / undertone / season pipeline using
// known skin-tone reference values. No test framework needed.

import {
  rgbToLab,
  itaOf,
  undertoneOf,
  depthOf,
  analyzeSkinTone,
  hexToRgb,
  clarityOf,
  clarityBand,
  classifySeason,
  seasonDef,
} from "../src/lib/color.ts";

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

function approx(a, b, tol = 1.5) {
  return Math.abs(a - b) <= tol;
}

// --- CIELAB reference values (D65) ---------------------------------------
// White -> L≈100, a≈0, b≈0
const white = rgbToLab({ r: 255, g: 255, b: 255 });
assert("white L≈100", approx(white.L, 100, 0.5));
assert("white a≈0", approx(white.a, 0, 0.5));
assert("white b≈0", approx(white.b, 0, 0.5));

// Black -> L≈0
const black = rgbToLab({ r: 0, g: 0, b: 0 });
assert("black L≈0", approx(black.L, 0, 0.5));

// Mid grey -> a≈0, b≈0 (neutral)
const grey = rgbToLab({ r: 128, g: 128, b: 128 });
assert("grey a≈0", approx(grey.a, 0, 0.5));
assert("grey b≈0", approx(grey.b, 0, 0.5));

// Pure red sRGB -> known Lab ~ (53.24, 80.09, 67.20)
const red = rgbToLab({ r: 255, g: 0, b: 0 });
assert("red L≈53.24", approx(red.L, 53.24));
assert("red a≈80.09", approx(red.a, 80.09));
assert("red b≈67.20", approx(red.b, 67.2));

// --- ITA° ordering: lighter skin -> higher ITA ---------------------------
const lightIta = itaOf(rgbToLab(hexToRgb("#f0c8a0")));
const deepIta = itaOf(rgbToLab(hexToRgb("#8a5a3c")));
assert("lighter skin has higher ITA than deeper", lightIta > deepIta);
assert("light skin depth = light", depthOf(lightIta) === "light");
assert("deep skin depth = medium|deep", ["medium", "deep"].includes(depthOf(deepIta)));

// --- Undertone: golden vs pink ------------------------------------------
const golden = undertoneOf(rgbToLab(hexToRgb("#d9a679"))); // warm golden
const pink = undertoneOf(rgbToLab(hexToRgb("#e8b4c8"))); // cool pink
assert("golden skin reads warm", golden === "warm");
assert("pink skin reads cool", pink === "cool");

// --- Full analysis produces a coherent season + palette ------------------
const t = analyzeSkinTone("#c98a6b");
assert("analysis returns a season label", typeof t.seasonLabel === "string" && t.seasonLabel.length > 0);
assert("analysis returns a 6-colour palette", t.palette.length === 6);
assert("every palette colour is a hex", t.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex)));
assert("ita is a finite number", Number.isFinite(t.ita));

// --- Clarity is depth-relative -------------------------------------------
// The same absolute chroma must NOT mean the same thing at different depths:
// baseline skin chroma rises from light to medium skin, so a fixed cutoff
// silently classifies every medium tone into the same bucket.
assert("same chroma reads brighter on light skin than medium", clarityOf(30, "light") > clarityOf(30, "medium"));
assert("clarity ~1.0 is the 'true' band", clarityBand(1.0) === "true");
assert("high relative chroma is 'bright'", clarityBand(1.4) === "bright");
assert("low relative chroma is 'soft'", clarityBand(0.6) === "soft");

// --- Every one of the 12 seasons is reachable ----------------------------
// Regression guard: the previous classifier could only ever emit 6 seasons,
// because it compared raw C* against fixed thresholds.
const ALL_SEASONS = [
  "light-spring", "true-spring", "bright-spring",
  "light-summer", "true-summer", "soft-summer",
  "soft-autumn", "true-autumn", "deep-autumn",
  "true-winter", "deep-winter", "bright-winter",
];
const reachable = new Set();
for (const u of ["warm", "cool", "neutral"]) {
  for (const d of ["light", "medium", "deep"]) {
    for (let c = 1; c <= 70; c += 0.5) reachable.add(classifySeason(u, d, c));
  }
}
for (const s of ALL_SEASONS) {
  assert(`season "${s}" is reachable`, reachable.has(s));
}

// --- Specific skin tones map to the expected season ----------------------
// These are the assertions that actually pin the product output. Previously
// nothing tested classifySeason at all.
const SEASON_CASES = [
  ["#f0c8a0", "bright-spring"], // light, warm, clear
  ["#ffe0bd", "light-spring"],  // light, warm, average clarity
  ["#c68642", "true-spring"],   // medium, warm, very clear
  ["#e0ac69", "true-autumn"],   // medium, warm, average clarity
  ["#b98d6f", "soft-autumn"],   // medium, warm, muted
  ["#a9714f", "deep-autumn"],   // deep, warm, clear
  ["#d8a08c", "true-summer"],   // light, cool, clear
  ["#e3b7a8", "light-summer"],  // light, cool, average clarity
  ["#f2cec2", "soft-summer"],   // light, cool, muted
  ["#7a4a3a", "true-winter"],   // deep, cool, average clarity
  ["#5c3a28", "deep-winter"],   // deep, muted
];
for (const [hex, expected] of SEASON_CASES) {
  const got = analyzeSkinTone(hex).season;
  assert(`${hex} -> ${expected}`, got === expected);
}
assert("cool + deep + high clarity -> bright-winter", classifySeason("cool", "deep", 32) === "bright-winter");

// --- Deep skin is not collapsed into a single answer ---------------------
// The old classifier returned "deep-autumn" for EVERY warm deep tone and could
// only ever give deep skin two of the twelve seasons. That is both an accuracy
// bug and a fairness bug, so it gets an explicit guard.
const DEEP_TONES = ["#a9714f", "#8d5524", "#8a5a3c", "#9c6b4f", "#6b4433", "#7a4a3a", "#5c3a28", "#4a3223", "#3b2418"];
const deepSeasons = new Set(DEEP_TONES.map((h) => analyzeSkinTone(h).season));
assert("deep tones are all classified as deep", DEEP_TONES.every((h) => analyzeSkinTone(h).depth === "deep"));
assert(`deep skin spans >=3 seasons (got ${deepSeasons.size})`, deepSeasons.size >= 3);

// --- Every season resolves to a well-formed palette ----------------------
for (const s of ALL_SEASONS) {
  const def = seasonDef(s);
  assert(
    `"${s}" has a label + 6 valid hex palette colours`,
    !!def &&
      typeof def.label === "string" &&
      def.label.length > 0 &&
      def.palette.length === 6 &&
      def.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex)),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
