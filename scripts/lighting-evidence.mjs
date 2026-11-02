// Lighting stress test, as pre-registered in docs/evidence/LIGHTING_PREREGISTRATION.md.
// Selfies are not committed, so this needs a folder of framed photos:
//   node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/lighting-evidence.mjs <dir>
// Writes data/evidence/lighting.json.

import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { normalizeIllumination } from "../src/lib/white-balance.ts";
import { sampleSkinHex } from "../src/lib/image.ts";
import { analyzeAppearance } from "../src/lib/season.ts";
import { seasonDistance } from "../src/lib/agreement.ts";
import { deltaE } from "../src/lib/fashion/colourways.ts";
import { hexToRgb, rgbToLab } from "../src/lib/color.ts";
import { HAIR_OPTIONS, EYE_OPTIONS } from "../src/lib/appearance-options.ts";

const CASTS = {
  "warm lamp": [1.25, 1, 0.7],
  "cool LED": [0.85, 1, 1.2],
  "green fluorescent": [0.9, 1.1, 0.85],
  "magenta tint": [1.1, 0.88, 1.05],
  dim: [0.6, 0.6, 0.6],
  "very dim": [0.4, 0.4, 0.4],
  bright: [1.3, 1.3, 1.3],
};
const hair = HAIR_OPTIONS[0].hex;
const eye = EYE_OPTIONS[0].hex;
const labOf = (hex) => rgbToLab(hexToRgb(hex));
const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : null;
};
const round = (n) => (n === null ? null : Math.round(n * 10) / 10);

function ctxFor(pixels, w, h) {
  const img = { data: pixels, width: w, height: h };
  return {
    getImageData(x, y, cw, ch) {
      if (x === 0 && y === 0 && cw === w && ch === h) return img;
      const data = new Uint8ClampedArray(cw * ch * 4);
      for (let row = 0; row < ch; row++) {
        const from = ((y + row) * w + x) * 4;
        data.set(pixels.subarray(from, from + cw * 4), row * cw * 4);
      }
      return { data, width: cw, height: ch };
    },
    putImageData() {},
  };
}

/** The app's order: correct the light, sample the skin, classify. */
function read(pixels, w, h, correct) {
  const copy = new Uint8ClampedArray(pixels);
  const ctx = ctxFor(copy, w, h);
  const light = correct ? normalizeIllumination(ctx, w, h) : null;
  const skin = sampleSkinHex(ctx, w, h);
  if (!skin) return { hex: null, season: null, confident: false };
  const heavy = light ? light.castStrength > 0.55 || light.exposureGain > 1.8 : false;
  return {
    hex: skin.hex,
    season: analyzeAppearance({ skin: skin.hex, hair, eye }).season,
    confident: skin.ratio >= 0.15 && !heavy,
  };
}

const dir = process.argv[2];
const cases = [];
const references = [];
for (const file of readdirSync(dir).sort()) {
  const photo = file.replace(/\.[^.]+$/, "");
  const { data, info } = await sharp(join(dir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const base = new Uint8ClampedArray(data);
  const refFixed = read(base, w, h, true);
  const refRaw = read(base, w, h, false);
  references.push({ photo, hex: refFixed.hex, season: refFixed.season, confident: refFixed.confident });

  for (const [condition, [r, g, b]] of Object.entries(CASTS)) {
    const cast = new Uint8ClampedArray(base);
    for (let i = 0; i < cast.length; i += 4) {
      cast[i] *= r;
      cast[i + 1] *= g;
      cast[i + 2] *= b;
    }
    const fixed = read(cast, w, h, true);
    const raw = read(cast, w, h, false);
    const distance = fixed.season && refFixed.season ? seasonDistance(refFixed.season, fixed.season) : null;
    cases.push({
      photo,
      condition,
      hex: fixed.hex,
      deltaE: fixed.hex && refFixed.hex ? round(deltaE(labOf(refFixed.hex), labOf(fixed.hex))) : null,
      deltaEUncorrected: raw.hex && refRaw.hex ? round(deltaE(labOf(refRaw.hex), labOf(raw.hex))) : null,
      season: fixed.season,
      sameSeason: fixed.season !== null && fixed.season === refFixed.season,
      seasonDistance: distance === null ? null : Math.round(distance * 100) / 100,
      flagged: !fixed.confident,
    });
  }
}

const num = (key) => cases.map((c) => c[key]).filter((v) => v !== null);
const share = (list, test) => (list.length ? list.filter(test).length / list.length : null);
const changed = cases.filter((c) => !c.sameSeason);
const medCorrected = median(num("deltaE"));
const medUncorrected = median(num("deltaEUncorrected"));
const sameShare = share(cases, (c) => c.sameSeason);
const nearShare = share(cases, (c) => c.seasonDistance !== null && c.seasonDistance <= 0.33);
const flaggedShare = share(changed, (c) => c.flagged);

const out = {
  question: "How far do measured skin colour and season move under simulated light?",
  notAccuracy: "The reference is MIROIR's own no-cast reading, not a colorimeter or an analyst. One person, seven photos.",
  rules: "docs/evidence/LIGHTING_PREREGISTRATION.md",
  cases: cases.length,
  rulesResult: {
    L1: { value: { corrected: round(medCorrected), uncorrected: round(medUncorrected) }, pass: medCorrected < medUncorrected },
    L2: { value: round(medCorrected), threshold: 10, pass: medCorrected <= 10 },
    L3: { value: round(sameShare * 100), threshold: 80, pass: sameShare >= 0.8 },
    L4: { value: round(nearShare * 100), threshold: 90, pass: nearShare >= 0.9 },
    L5: { value: flaggedShare === null ? null : round(flaggedShare * 100), threshold: 80, seasonChanges: changed.length, pass: flaggedShare === null ? null : flaggedShare >= 0.8 },
  },
  byCondition: Object.keys(CASTS).map((condition) => {
    const c = cases.filter((x) => x.condition === condition);
    return {
      condition,
      medianDeltaE: round(median(c.map((x) => x.deltaE).filter((v) => v !== null))),
      medianDeltaEUncorrected: round(median(c.map((x) => x.deltaEUncorrected).filter((v) => v !== null))),
      sameSeasonPercent: round(share(c, (x) => x.sameSeason) * 100),
    };
  }),
  references,
  allCases: cases,
};
mkdirSync("data/evidence", { recursive: true });
writeFileSync("data/evidence/lighting.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ rulesResult: out.rulesResult, byCondition: out.byCondition, references }, null, 1));
