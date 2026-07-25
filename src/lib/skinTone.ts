// Server-only skin-colour sampler.
//
// The Skin Analysis API returns concern scores but not the wearer's skin
// colour, so we measure it directly from the selfie they already uploaded.
// Using `sharp` we sample the central face region, keep only skin-like pixels
// (rejecting hair, background, shadows and blown-out highlights), and average
// them into one representative sRGB colour. The colour engine (lib/color.ts)
// then does the CIELAB / ITA° / season science.
//
// The scan photos are center-cropped 3:4 portraits with the face centered, so
// a rectangle around the middle reliably lands on cheeks/forehead.

import "server-only";
import sharp from "sharp";
import { analyzeSkinTone, rgbToHex, type SkinTone } from "@/lib/color";

/** Is a pixel plausibly facial skin? Broad across skin depths, rejects
 *  hair/background/shadow/highlight and strongly non-skin hues. */
function isSkinPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // reject near-black (shadow/hair) and near-white (blown highlight)
  if (max < 40 || min > 245) return false;
  // skin is warm: red >= green >= blue, with red clearly dominant over blue
  if (!(r > g && g > b)) return false;
  if (r - b < 12) return false; // too grey to be skin
  // reject extreme saturation (lips, strong background colours)
  const sat = (max - min) / (max || 1);
  if (sat > 0.62) return false;
  return true;
}

export interface SampledTone extends SkinTone {
  /** How many skin-like pixels the estimate is based on (confidence signal). */
  sampleCount: number;
  lowConfidence: boolean;
}

/**
 * Samples a representative skin colour from image bytes and returns the full
 * tone analysis. Throws if no usable skin pixels are found.
 */
export async function sampleSkinTone(bytes: Uint8Array): Promise<SampledTone> {
  const img = sharp(Buffer.from(bytes)).rotate(); // honour EXIF orientation
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("could not read image dimensions");

  // Central face window: horizontally centered, biased slightly above middle
  // (cheeks/forehead rather than chin/neck).
  const cropW = Math.round(W * 0.5);
  const cropH = Math.round(H * 0.4);
  const left = Math.round((W - cropW) / 2);
  const top = Math.round(H * 0.22);

  const { data, info } = await img
    .extract({ left, top, width: cropW, height: cropH })
    .resize(64, 64, { fit: "fill" }) // downsample for a fast, stable average
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels; // 3 (rgb) or 4 (rgba)
  let rs = 0;
  let gs = 0;
  let bs = 0;
  let n = 0;

  for (let i = 0; i < data.length; i += ch) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isSkinPixel(r, g, b)) {
      rs += r;
      gs += g;
      bs += b;
      n++;
    }
  }

  // Fallback: if strict skin filter found too little, use a trimmed average of
  // the whole window (still center-face, just less strict).
  let lowConfidence = false;
  if (n < 40) {
    lowConfidence = true;
    rs = gs = bs = n = 0;
    for (let i = 0; i < data.length; i += ch) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      if (max < 40 || max > 250) continue; // drop shadow + highlight only
      rs += r;
      gs += g;
      bs += b;
      n++;
    }
    if (n === 0) throw new Error("no usable pixels to sample skin tone");
  }

  const hex = rgbToHex({ r: rs / n, g: gs / n, b: bs / n });
  const tone = analyzeSkinTone(hex);
  return { ...tone, sampleCount: n, lowConfidence };
}
