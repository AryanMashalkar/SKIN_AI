"use client";

// Downscales a person photo for virtual try-on. Unlike the skin scanner we do
// NOT crop to the face — VTO wants the whole upper/full body — we just cap the
// resolution to keep the upload small and re-encode as clean JPEG.

import { assertUsableImage, MAX_UPLOAD_BYTES } from "@/lib/image";

const MAX_EDGE = 1280;

export interface FashionPhoto {
  dataUrl: string;
  previewUrl: string;
}

/** Approximate decoded byte length of a base64 data URL (4 chars -> 3 bytes). */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return Math.floor(((dataUrl.length - comma - 1) * 3) / 4);
}

export async function preparePhoto(file: File): Promise<FashionPhoto> {
  assertUsableImage(file);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  let w = bitmap.width;
  let h = bitmap.height;
  const long = Math.max(w, h);
  if (long > MAX_EDGE) {
    const scale = MAX_EDGE / long;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);

  // This one is sent as a base64 data URL (~1.37x the binary size), so step the
  // quality down until the encoded string is safely under the route's limit.
  let dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  for (let q = 0.75; dataUrlBytes(dataUrl) > MAX_UPLOAD_BYTES && q >= 0.4; q -= 0.15) {
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  if (dataUrlBytes(dataUrl) > MAX_UPLOAD_BYTES) {
    throw new Error("That photo is too large to process — try a smaller one.");
  }

  return {
    dataUrl,
    previewUrl: canvas.toDataURL("image/jpeg", 0.7),
  };
}
