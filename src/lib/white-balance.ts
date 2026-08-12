"use client";

// Illuminant correction for scan photos.
//
// A webcam under artificial light applies its own auto white balance and often
// gets it wrong - typically a green cast from fluorescent/LED lighting, plus
// under-exposure because the sensor is starved. Both distort the measured skin
// colour, and since undertone is read from the a*/b* balance in CIELAB, a green
// cast pushes the reading cool and can flip the reported season outright.
//
// So this is not cosmetic retouching: without it we would be doing precise
// arithmetic on a corrupted input and reporting high confidence in the answer.
//
// Method: "Shades of Grey" (Finlayson & Trezzi, 2004) - the Minkowski-norm
// generalisation of grey-world. Plain grey-world assumes the scene averages to
// neutral, which a large block of skin or a coloured wall breaks badly. Using
// a higher norm (p=6) weights brighter pixels more and is markedly more robust
// on real photos, while staying a few lines of arithmetic.

export interface IlluminationFix {
  /** Per-channel gains that were applied. */
  gains: [number, number, number];
  /** Exposure multiplier applied on top. 1 = untouched. */
  exposureGain: number;
  /**
   * 0..1. How far the scene illuminant was from neutral. High values mean the
   * colour reading rests on a big correction and should be trusted less.
   */
  castStrength: number;
  /** Mean luma of the subject region BEFORE correction, 0-255. */
  originalLuma: number;
}

/** Target mean luma for the subject region. Mid-grey-ish, not blown out. */
const TARGET_LUMA = 118;
/** Never amplify more than this - beyond it we are amplifying sensor noise. */
const MAX_EXPOSURE_GAIN = 2.2;
/** Minkowski norm order. 1 = grey-world, infinity = max-RGB. 6 is a good middle. */
const NORM_P = 6;

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Estimates the scene illuminant and neutralises it in place, then lifts
 * exposure toward a usable level.
 *
 * Returns what it had to do, so callers can lower reported confidence when the
 * correction was heavy.
 */
export function normalizeIllumination(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): IlluminationFix {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // --- estimate the illuminant from the central subject region ------------
  // Sampling the whole frame lets a strongly coloured background dominate.
  const x0 = Math.floor(w * 0.2);
  const x1 = Math.ceil(w * 0.8);
  const y0 = Math.floor(h * 0.12);
  const y1 = Math.ceil(h * 0.85);

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let lumaSum = 0;
  let n = 0;

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      // Skip clipped pixels: they carry no illuminant information.
      if (r > 250 && g > 250 && b > 250) continue;
      sr += r ** NORM_P;
      sg += g ** NORM_P;
      sb += b ** NORM_P;
      lumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n++;
    }
  }

  if (n === 0) {
    return {
      gains: [1, 1, 1],
      exposureGain: 1,
      castStrength: 0,
      originalLuma: 0,
    };
  }

  const originalLuma = lumaSum / n;
  const er = (sr / n) ** (1 / NORM_P);
  const eg = (sg / n) ** (1 / NORM_P);
  const eb = (sb / n) ** (1 / NORM_P);

  // Normalise so the correction preserves overall brightness; exposure is
  // handled separately and explicitly.
  const eMean = (er + eg + eb) / 3 || 1;
  let gr = eMean / (er || 1);
  let gg = eMean / (eg || 1);
  let gb = eMean / (eb || 1);

  // How far from neutral was the illuminant? Used to discount confidence.
  const spread = Math.max(er, eg, eb) - Math.min(er, eg, eb);
  const castStrength = Math.min(1, spread / (eMean || 1) / 0.45);

  // Bound the gains. An extreme estimate usually means the estimator was
  // fooled (a strongly coloured shirt or wall), and applying it would make
  // things worse than leaving them alone.
  const bound = (g: number) => Math.max(0.75, Math.min(1.35, g));
  gr = bound(gr);
  gg = bound(gg);
  gb = bound(gb);

  // --- exposure -----------------------------------------------------------
  const exposureGain = Math.max(
    1,
    Math.min(MAX_EXPOSURE_GAIN, TARGET_LUMA / Math.max(originalLuma, 1)),
  );

  const fr = gr * exposureGain;
  const fg = gg * exposureGain;
  const fb = gb * exposureGain;

  // Only rewrite pixels if we are actually changing something meaningful.
  const changes =
    Math.abs(fr - 1) > 0.01 || Math.abs(fg - 1) > 0.01 || Math.abs(fb - 1) > 0.01;
  if (changes) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp255(d[i] * fr);
      d[i + 1] = clamp255(d[i + 1] * fg);
      d[i + 2] = clamp255(d[i + 2] * fb);
    }
    ctx.putImageData(img, 0, 0);
  }

  return {
    gains: [gr, gg, gb],
    exposureGain,
    castStrength,
    originalLuma,
  };
}
