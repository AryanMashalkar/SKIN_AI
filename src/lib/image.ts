"use client";

// Client-side image preprocessing to maximize Perfect Corp acceptance rate.
// The API rejects images where the face is too small or the file is oversized,
// so we center-crop to a 3:4 portrait, normalize resolution, and re-encode as
// clean JPEG before uploading.

const TARGET_ASPECT = 3 / 4; // width / height (portrait)
// Perfect Corp's skin analysis needs a high-resolution face that fills a good
// portion of the frame (head-and-shoulders), or it rejects with
// `error_src_face_too_small` / `error_below_min_image_size`. Verified against
// the live API: ~2048px short edge with the whole head + margin passes.
const MIN_SHORT_EDGE = 1440;
const MAX_LONG_EDGE = 2560;
const JPEG_QUALITY = 0.95;

export interface Processed {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  /** Representative skin colour hex sampled from the face region, or null. */
  skinHex: string | null;
}

/** Is a pixel plausibly facial skin? Broad across skin depths; rejects
 *  hair/background/shadow/highlight and strongly non-skin hues. */
function isSkinPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40 || min > 245) return false;
  if (!(r > g && g > b)) return false;
  if (r - b < 12) return false;
  const sat = (max - min) / (max || 1);
  if (sat > 0.62) return false;
  return true;
}

/** Samples a representative skin colour from the central face region of a
 *  drawn canvas. Returns a hex string, or null if too few skin pixels. */
function sampleSkinHex(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): string | null {
  // Central window biased slightly above middle (cheeks/forehead).
  const cx = Math.round(w * 0.25);
  const cy = Math.round(h * 0.22);
  const cw = Math.round(w * 0.5);
  const ch = Math.round(h * 0.4);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(cx, cy, cw, ch).data;
  } catch {
    return null;
  }

  let rs = 0;
  let gs = 0;
  let bs = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
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
  if (n < 50) return null;

  const to2 = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to2(rs / n)}${to2(gs / n)}${to2(bs / n)}`;
}

export async function preprocessImage(file: File): Promise<Processed> {
  const bitmap = await loadBitmap(file);

  // Determine a 3:4 crop rectangle centered on the source.
  const srcAspect = bitmap.width / bitmap.height;
  let cropW = bitmap.width;
  let cropH = bitmap.height;
  if (srcAspect > TARGET_ASPECT) {
    // too wide -> crop sides
    cropW = Math.round(bitmap.height * TARGET_ASPECT);
  } else {
    // too tall -> crop top/bottom
    cropH = Math.round(bitmap.width / TARGET_ASPECT);
  }
  const cropX = Math.round((bitmap.width - cropW) / 2);
  const cropY = Math.round((bitmap.height - cropH) / 2);

  // Target output size: keep portrait, ensure the short edge is big enough
  // for face detection, but cap the long edge.
  let outW = cropW;
  let outH = cropH;
  if (outW < MIN_SHORT_EDGE) {
    const scale = MIN_SHORT_EDGE / outW;
    outW = MIN_SHORT_EDGE;
    outH = Math.round(outH * scale);
  }
  if (outH > MAX_LONG_EDGE) {
    const scale = MAX_LONG_EDGE / outH;
    outH = MAX_LONG_EDGE;
    outW = Math.round(outW * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Failed to encode image");

  return {
    blob,
    previewUrl: canvas.toDataURL("image/jpeg", 0.8),
    width: outW,
    height: outH,
    skinHex: sampleSkinHex(ctx, outW, outH),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}
