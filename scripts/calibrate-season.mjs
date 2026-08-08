// Parameter calibration for the twelve-tone season engine.
//
//   node --experimental-strip-types --import ./scripts/register-alias.mjs \
//     scripts/calibrate-season.mjs
//
// Grid-searches the free parameters of the three axes against the reference
// archetypes, instead of hand-tuning them until the demo looks right.
//
// IMPORTANT LIMITATION: the reference set is 24 synthetic archetypes authored
// alongside this engine. Fitting ~6 parameters to 24 self-authored cases risks
// overfitting, so the script reports a held-out score (fit on one archetype per
// season, score on the other) as well as the full-set score. Treat the held-out
// number as the honest one, and neither as clinical validation.

import { readFileSync } from "node:fs";
import { hexToRgb, rgbToLab, chromaOf } from "../src/lib/color.ts";

const raw = JSON.parse(
  readFileSync(new URL("../data/seasons/reference-archetypes.json", import.meta.url), "utf8"),
);
const cases = raw.cases;

const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

function measure(hex) {
  const lab = rgbToLab(hexToRgb(hex));
  const chroma = chromaOf(lab);
  return { lab, chroma, hueWeight: Math.min(1, chroma / 15) };
}

function referenceChroma(L) {
  if (L > 65) return 20;
  if (L > 45) return 32;
  return 26;
}

const SEASON_BY_DOMINANCE = {
  "value:light:warm": "light-spring",
  "value:light:cool": "light-summer",
  "value:deep:warm": "deep-autumn",
  "value:deep:cool": "deep-winter",
  "chroma:bright:warm": "bright-spring",
  "chroma:bright:cool": "bright-winter",
  "chroma:soft:warm": "soft-autumn",
  "chroma:soft:cool": "soft-summer",
  "hue:warm:light": "true-spring",
  "hue:warm:deep": "true-autumn",
  "hue:cool:light": "true-summer",
  "hue:cool:deep": "true-winter",
};

function classify(c, p) {
  const skin = measure(c.skin);
  const hair = c.hair ? measure(c.hair) : undefined;
  const eye = c.eye ? measure(c.eye) : undefined;

  const skinH = clamp((skin.lab.b - skin.lab.a - 5) / p.skinHueDiv);
  const pig = (f) => clamp((f.lab.b - 0.3 * f.lab.a - 10) / p.pigHueDiv) * f.hueWeight;

  const hp = [[skinH, 0.5]];
  if (hair) hp.push([pig(hair), 0.3]);
  if (eye) hp.push([pig(eye), 0.2]);
  const hw = hp.reduce((s, [, w]) => s + w, 0);
  const hue = clamp(hp.reduce((s, [v, w]) => s + v * w, 0) / hw);

  const vp = [[skin.lab.L, hair ? 0.35 : 1]];
  if (hair) vp.push([hair.lab.L, 0.45]);
  if (eye) vp.push([eye.lab.L, 0.2]);
  const vw = vp.reduce((s, [, w]) => s + w, 0);
  const meanL = vp.reduce((s, [l, w]) => s + l * w, 0) / vw;
  const value = clamp((meanL - p.valueMid) / p.valueSpread);

  const chromatic = [skin, eye].filter(Boolean);
  const relative = Math.max(...chromatic.map((f) => f.chroma / referenceChroma(f.lab.L)));
  const saturation = clamp((relative - 1) / p.satDiv);
  const feats = [skin, hair, eye].filter(Boolean);
  const ls = feats.map((f) => f.lab.L);
  const spread = Math.max(...ls) - Math.min(...ls);
  const contrast = clamp((spread - p.contrastMid) / p.contrastSpread);
  const chroma = clamp(saturation * (1 - p.contrastWeight) + contrast * p.contrastWeight);

  const axes = { hue: Math.abs(hue), value: Math.abs(value), chroma: Math.abs(chroma) };
  const dominant = ["hue", "value", "chroma"].reduce((b, a) => (axes[a] > axes[b] ? a : b));
  const warm = hue >= 0;
  let key;
  if (dominant === "value") key = `value:${value >= 0 ? "light" : "deep"}:${warm ? "warm" : "cool"}`;
  else if (dominant === "chroma") key = `chroma:${chroma >= 0 ? "bright" : "soft"}:${warm ? "warm" : "cool"}`;
  else key = `hue:${warm ? "warm" : "cool"}:${value >= 0 ? "light" : "deep"}`;
  return SEASON_BY_DOMINANCE[key];
}

const score = (set, p) => set.filter((c) => classify(c, p) === c.expected).length;

// Fit on "-1" archetypes, hold out "-2" archetypes.
const fitSet = cases.filter((c) => c.id.endsWith("-1"));
const holdSet = cases.filter((c) => c.id.endsWith("-2"));

const GRID = {
  skinHueDiv: [10, 13, 16, 20],
  pigHueDiv: [15, 19, 24, 30],
  valueMid: [48, 52, 56],
  valueSpread: [28, 33, 38],
  satDiv: [0.35, 0.5, 0.7],
  contrastMid: [30, 35, 42],
  contrastSpread: [20, 25, 32],
  contrastWeight: [0.5, 0.65, 0.8],
};

const keys = Object.keys(GRID);
let best = null;
let evaluated = 0;

function* combos(i = 0, acc = {}) {
  if (i === keys.length) {
    yield { ...acc };
    return;
  }
  for (const v of GRID[keys[i]]) yield* combos(i + 1, { ...acc, [keys[i]]: v });
}

for (const p of combos()) {
  evaluated++;
  const fit = score(fitSet, p);
  if (!best || fit > best.fit) best = { p, fit, hold: score(holdSet, p) };
}

const full = score(cases, best.p);
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;

console.log("=".repeat(66));
console.log("SEASON ENGINE PARAMETER CALIBRATION");
console.log("=".repeat(66));
console.log(`configurations evaluated : ${evaluated}`);
console.log(`fit set   (12 archetypes): ${best.fit}/12  ${pct(best.fit, 12)}`);
console.log(`HELD OUT  (12 archetypes): ${best.hold}/12  ${pct(best.hold, 12)}   <- the honest number`);
console.log(`full set  (24 archetypes): ${full}/24  ${pct(full, 24)}`);
console.log("-".repeat(66));
console.log("best parameters:");
for (const k of keys) console.log(`  ${k.padEnd(16)} ${best.p[k]}`);
console.log("-".repeat(66));
console.log("Fitted on 24 SYNTHETIC self-authored archetypes. The held-out score");
console.log("is the only one worth quoting, and it is still not evidence of");
console.log("agreement with human analysts on real photographs.");
console.log("=".repeat(66));
