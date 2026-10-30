"use client";

// Browser-side garment recolouring for colourways and the "prove it" shot.
//
// We take a product garment image and re-tint the fabric to a target colour
// while preserving its shading (folds, highlights, shadows): each pixel takes
// the target's Hue+Saturation, and its Lightness is remapped so the garment's
// average matches the target's (see lightness.ts). Near-white background
// pixels are left untouched so only the garment is recoloured. Running this in
// the browser keeps the heavy native `sharp` dependency off the serverless
// runtime.

import { remapLightness } from "@/lib/fashion/lightness";

const cache = new Map<string, Promise<string>>();

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

function isBackground(r: number, g: number, b: number): boolean {
  return r > 235 && g > 235 && b > 235;
}

/**
 * Recolours a garment image to `targetHex`, preserving shading. Returns a JPEG
 * data URL. Near-white background pixels are kept white. Results are cached
 * per image and colour, since every card and modal asks for the same few.
 */
export function recolorGarment(imageSrc: string, targetHex: string): Promise<string> {
  const key = `${imageSrc}|${targetHex}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = render(imageSrc, targetHex);
    // A failed render must not poison the cache for the next attempt.
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

async function render(imageSrc: string, targetHex: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 512;
  canvas.height = img.naturalHeight || 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const [th, ts, tl] = hexToHsl(targetHex);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;

  // First pass: the garment's median lightness, background excluded. Median,
  // not mean: a dark lining or open zip pulls the mean down, which then lifts
  // the fabric itself well above the swatch the shopper picked.
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (isBackground(px[i], px[i + 1], px[i + 2])) continue;
    histogram[Math.round(rgbToHsl(px[i], px[i + 1], px[i + 2])[2] * 255)]++;
    count++;
  }
  let median = 0.5;
  for (let bin = 0, seen = 0; bin < 256 && count; bin++) {
    seen += histogram[bin];
    if (seen >= count / 2) {
      median = bin / 255;
      break;
    }
  }
  // The swatch's own saturation, so the render matches the dot the shopper
  // clicked. (An earlier "nudge" also tinted greys red, since their hue is 0.)
  const sat = ts;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (isBackground(r, g, b)) continue;
    const [, , l] = rgbToHsl(r, g, b);
    const [nr, ng, nb] = hslToRgb(th, sat, remapLightness(l, median, tl));
    px[i] = nr;
    px[i + 1] = ng;
    px[i + 2] = nb;
  }

  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}
