// Illuminant-correction tests. Run with: npm test
//
// This runs before skin colour is sampled, so if it is wrong every downstream
// number - undertone, ITA, season - is wrong with it. Verified against
// synthetic scenes with a known cast rather than by eyeballing a photo.

import { normalizeIllumination } from "../src/lib/white-balance.ts";

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

/**
 * Minimal 2D-context stand-in. Only getImageData/putImageData are used, so a
 * real canvas is unnecessary and this stays runnable in plain Node.
 */
function fakeCtx(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = fill(i % w, Math.floor(i / w));
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  const img = { data, width: w, height: h };
  return {
    ctx: { getImageData: () => img, putImageData: () => {} },
    img,
  };
}

const W = 60;
const H = 80;

/** Mean RGB of the central region the estimator actually samples. */
function centreMean(img) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(H * 0.2); y < H * 0.8; y++) {
    for (let x = Math.floor(W * 0.25); x < W * 0.75; x++) {
      const i = (y * W + x) * 4;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
  }
  return [r / n, g / n, b / n];
}

// --- a green cast must be neutralised -------------------------------------
// Neutral grey scene photographed under green-biased light.
{
  const { ctx, img } = fakeCtx(W, H, () => [110, 150, 110]);
  const before = centreMean(img);
  const fix = normalizeIllumination(ctx, W, H);
  const after = centreMean(img);

  const greenExcessBefore = before[1] - (before[0] + before[2]) / 2;
  const greenExcessAfter = after[1] - (after[0] + after[2]) / 2;

  assert("green cast is detected", fix.castStrength > 0);
  assert(
    `green excess reduced (${greenExcessBefore.toFixed(0)} -> ${greenExcessAfter.toFixed(0)})`,
    greenExcessAfter < greenExcessBefore,
  );
  assert("green channel was pulled down", fix.gains[1] < 1);
  assert("red channel was pushed up", fix.gains[0] > 1);
}

// --- an already-neutral scene must be left alone --------------------------
{
  const { ctx, img } = fakeCtx(W, H, () => [120, 120, 120]);
  const fix = normalizeIllumination(ctx, W, H);
  const after = centreMean(img);
  assert("neutral scene reports no cast", fix.castStrength < 0.02);
  assert("neutral scene keeps balanced channels",
    Math.abs(after[0] - after[1]) < 2 && Math.abs(after[1] - after[2]) < 2);
  assert("neutral mid-grey needs no exposure lift", fix.exposureGain < 1.05);
}

// --- a dark scene must be lifted, but not without limit -------------------
{
  const { ctx, img } = fakeCtx(W, H, () => [30, 34, 30]);
  const before = centreMean(img);
  const fix = normalizeIllumination(ctx, W, H);
  const after = centreMean(img);
  assert("dark scene is brightened", after[0] > before[0]);
  assert("exposure gain is capped", fix.exposureGain <= 2.2);
  assert("original luma is reported", fix.originalLuma > 0 && fix.originalLuma < 60);
}

// A very dark frame must not be amplified without bound - past the cap we
// would be amplifying sensor noise and inventing colour.
{
  const { ctx } = fakeCtx(W, H, () => [4, 4, 4]);
  const fix = normalizeIllumination(ctx, W, H);
  assert("near-black is not amplified past the cap", fix.exposureGain <= 2.2);
}

// --- gains are bounded ----------------------------------------------------
// An extreme estimate usually means the estimator was fooled by a strongly
// coloured shirt or wall; applying it fully would be worse than doing nothing.
{
  const { ctx } = fakeCtx(W, H, () => [10, 200, 10]);
  const fix = normalizeIllumination(ctx, W, H);
  assert("gains stay within safe bounds",
    fix.gains.every((g) => g >= 0.75 && g <= 1.35));
  assert("extreme cast is flagged as low confidence", fix.castStrength > 0.5);
}

// --- clipped highlights must not be blown further -------------------------
{
  const { ctx, img } = fakeCtx(W, H, () => [255, 255, 255]);
  normalizeIllumination(ctx, W, H);
  const after = centreMean(img);
  assert("white stays within range", after.every((c) => c <= 255));
}

// --- degenerate input is safe --------------------------------------------
{
  const { ctx } = fakeCtx(1, 1, () => [128, 128, 128]);
  const fix = normalizeIllumination(ctx, 1, 1);
  assert("tiny image does not throw", Number.isFinite(fix.exposureGain));
  assert("tiny image returns finite gains", fix.gains.every(Number.isFinite));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
