"use client";

// Browser-side garment recolouring for the "prove it on your photo" comparison.
//
// We take a product garment image and re-tint the fabric to a target colour
// while preserving its shading (folds, highlights, shadows) — i.e. an HSL
// "colour" blend: keep each pixel's Lightness, replace its Hue+Saturation with
// the target's. Near-white background pixels are left untouched so only the
// garment is recoloured. Running this in the browser keeps the heavy native
// `sharp` dependency off the serverless runtime.

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Recolours a garment image to `targetHex`, preserving shading. Returns a JPEG
 * data URL. Near-white background pixels are kept white.
 */
export async function recolorGarment(
  imageSrc: string,
  targetHex: string,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 512;
  canvas.height = img.naturalHeight || 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const [th, ts] = hexToHsl(targetHex);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    // keep near-white background and near-black seams untouched
    if (r > 235 && g > 235 && b > 235) continue;
    const [, , l] = rgbToHsl(r, g, b);
    // Apply target hue+saturation, keep the pixel's own lightness. Nudge
    // saturation up a touch so the colour reads clearly on screen.
    const [nr, ng, nb] = hslToRgb(th, Math.min(1, ts * 0.9 + 0.15), l);
    px[i] = nr;
    px[i + 1] = ng;
    px[i + 2] = nb;
  }

  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}
