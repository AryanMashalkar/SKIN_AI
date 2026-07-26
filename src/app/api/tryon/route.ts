import { NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { garmentById } from "@/lib/fashion/products";
import { hasVtoKey, runClothTryOn } from "@/lib/fashion/vto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TryOnResponse {
  resultUrl: string;
  source: "perfectcorp" | "mock";
  note?: string;
}

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function onVercel(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * The public base URL Perfect Corp will use to fetch our garment images.
 *
 * Priority:
 *   1. On Vercel: ALWAYS the live deployment origin (a stale PUBLIC_BASE_URL
 *      pointing at a dead dev tunnel is a common cause of error_download_image,
 *      so we deliberately ignore it here).
 *   2. Local dev: an explicit PUBLIC_BASE_URL tunnel, else the request origin.
 */
function publicBase(req: NextRequest): string {
  if (onVercel()) {
    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
    return req.nextUrl.origin;
  }
  const env = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (env) return env;
  return req.nextUrl.origin;
}

/** Server-side reachability check so we can report exactly which image the VTO
 *  fetcher would fail to download. */
async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: {
    userPhotoDataUrl?: string;
    garmentId?: string;
    garmentImageDataUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ resultUrl: "", source: "mock", note: "Invalid body" }, 400);
  }

  const { userPhotoDataUrl, garmentId, garmentImageDataUrl } = body;
  const garment = garmentId ? garmentById(garmentId) : undefined;
  if (!garment) {
    return json({ resultUrl: "", source: "mock", note: "Unknown garment" }, 400);
  }

  const base = publicBase(req);
  // Default: the static garment image. If the client sent a recoloured variant
  // (proof-shot comparison), host that and use it as the garment instead.
  let refUrl = `${base}${garment.image}`;

  const isPublic = /^https:\/\//.test(base) && !base.includes("localhost");
  if (!hasVtoKey() || !isPublic) {
    return json({
      resultUrl: garmentImageDataUrl || garment.image,
      source: "mock",
      note: !hasVtoKey()
        ? "PERFECTCORP_API_KEY not set — showing garment preview."
        : "No public host for images (deploy, or set a PUBLIC_BASE_URL tunnel in dev) — showing garment preview.",
    });
  }

  if (!userPhotoDataUrl) {
    return json({ resultUrl: garment.image, source: "mock", note: "No photo" }, 400);
  }

  if (onVercel() && !hasBlob()) {
    return json({
      resultUrl: garmentImageDataUrl || garment.image,
      source: "mock",
      note: "Virtual try-on needs a Vercel Blob store connected (Storage → Blob) to host your photo. Showing garment preview.",
    });
  }

  try {
    const srcUrl = await hostUserPhoto(userPhotoDataUrl, base);
    if (garmentImageDataUrl) {
      refUrl = await hostUserPhoto(garmentImageDataUrl, base);
    }

    const [srcOk, refOk] = await Promise.all([
      isReachable(srcUrl),
      isReachable(refUrl),
    ]);
    if (!srcOk || !refOk) {
      const which = [!srcOk ? "your photo" : null, !refOk ? "the garment image" : null]
        .filter(Boolean)
        .join(" and ");
      return json({
        resultUrl: garmentImageDataUrl || garment.image,
        source: "mock",
        note: `Couldn't reach ${which} at a public URL (base: ${base}) — showing garment preview.`,
      });
    }

    const resultUrl = await runClothTryOn({
      srcUrl,
      refUrl,
      garmentCategory: garment.garmentCategory,
    });

    return json({ resultUrl, source: "perfectcorp" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return json({
      resultUrl: garmentImageDataUrl || garment.image,
      source: "mock",
      note: `Live try-on failed (${message}) — showing garment preview.`,
    });
  }
}

/** Decodes a base64 data URL and returns a publicly-reachable https URL. */
async function hostUserPhoto(dataUrl: string, base: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("invalid data URL");
  const mime = match[1];
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(match[2], "base64");
  const filename = `user-${randomUUID()}.${ext}`;

  if (hasBlob()) {
    const { url } = await put(`tryon/${filename}`, buf, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return url;
  }

  // Local-dev fallback: persist under /public/uploads and serve via the tunnel.
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);
  return `${base}/uploads/${filename}`;
}

function json(body: TryOnResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
