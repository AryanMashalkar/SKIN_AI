import { NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { garmentById } from "@/lib/fashion/products";
import { hasVtoKey, runClothTryOn } from "@/lib/fashion/vto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps serverless functions at 60s; Pro allows more. VTO
// generation is usually ~15-30s, comfortably inside this ceiling.
export const maxDuration = 60;

interface TryOnResponse {
  resultUrl: string;
  source: "perfectcorp" | "mock";
  note?: string;
}

// Perfect Corp's Apparel VTO API FETCHES both images from public URLs. The
// garment (`ref_file_url`) lives in /public, which is served publicly by the
// deployed host (or a dev tunnel). The user photo (`src_file_url`) is uploaded
// at runtime, so it needs a public home:
//   • On Vercel  -> Vercel Blob (BLOB_READ_WRITE_TOKEN is injected when a Blob
//                   store is connected to the project).
//   • Local dev  -> written to /public/uploads and served through the tunnel.
function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// The public base URL used to reach our garment images. Prefer an explicit
// tunnel (local dev); otherwise use the deployed request origin (Vercel).
function publicBase(req: NextRequest): string {
  const env = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (env) return env;
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  let body: { userPhotoDataUrl?: string; garmentId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ resultUrl: "", source: "mock", note: "Invalid body" }, 400);
  }

  const { userPhotoDataUrl, garmentId } = body;
  const garment = garmentId ? garmentById(garmentId) : undefined;
  if (!garment) {
    return json({ resultUrl: "", source: "mock", note: "Unknown garment" }, 400);
  }

  const base = publicBase(req);
  const refUrl = `${base}${garment.image}`;

  // The garment URL must be publicly fetchable. On localhost without a tunnel
  // (and no Blob), Perfect Corp can't reach it -> show the flat garment preview.
  const isPublic = /^https:\/\//.test(base) && !base.includes("localhost");
  if (!hasVtoKey() || !isPublic) {
    return json({
      resultUrl: garment.image,
      source: "mock",
      note: !hasVtoKey()
        ? "PERFECTCORP_API_KEY not set — showing garment preview."
        : "No public host for images (set PUBLIC_BASE_URL tunnel in dev, or deploy) — showing garment preview.",
    });
  }

  if (!userPhotoDataUrl) {
    return json({ resultUrl: garment.image, source: "mock", note: "No photo" }, 400);
  }

  try {
    // Give the user's photo a public URL (Blob on Vercel, filesystem in dev).
    const srcUrl = await hostUserPhoto(userPhotoDataUrl, base);

    const resultUrl = await runClothTryOn({
      srcUrl,
      refUrl,
      garmentCategory: garment.garmentCategory,
    });

    return json({ resultUrl, source: "perfectcorp" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return json({
      resultUrl: garment.image,
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
