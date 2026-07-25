"use client";

// Downscales a person photo for virtual try-on. Unlike the skin scanner we do
// NOT crop to the face — VTO wants the whole upper/full body — we just cap the
// resolution to keep the upload small and re-encode as clean JPEG.

const MAX_EDGE = 1280;

export interface FashionPhoto {
  dataUrl: string;
  previewUrl: string;
}

export async function preparePhoto(file: File): Promise<FashionPhoto> {
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

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    previewUrl: canvas.toDataURL("image/jpeg", 0.7),
  };
}
