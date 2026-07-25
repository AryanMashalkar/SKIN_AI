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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
