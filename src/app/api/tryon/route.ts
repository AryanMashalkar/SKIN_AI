import { NextRequest } from "next/server";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { garmentById } from "@/lib/fashion/products";
import { hasVtoKey, runClothTryOn } from "@/lib/fashion/vto";
import { check, clientKey, rateLimitHeaders, RULES } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps serverless functions at 60s. The VTO poll budget in
// `vto.ts` is deliberately sized to finish inside this with margin.
export const maxDuration = 60;

/**
 * Hard cap on a single decoded image (5 MB). The client downscales well below
 * this, so anything larger is a malformed or hostile request. Without this the
 * route would `Buffer.from()` an arbitrarily large attacker-controlled base64
 * string straight into serverless memory.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Matching cap on the raw JSON body (two images + fields, base64 ~1.37x). */
const MAX_BODY_BYTES = 15 * 1024 * 1024;

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
  // Each call costs a generation credit AND writes to blob storage, so this is
  // the more expensive of the two routes to leave open.
  const rl = check(`tryon:${clientKey(req)}`, RULES.tryOn);
  if (!rl.ok) {
    return json(
      {
        resultUrl: "",
        source: "mock",
        note: `Too many try-ons just now — try again in ${rl.retryAfter}s.`,
      },
      429,
      rateLimitHeaders(rl),
    );
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ resultUrl: "", source: "mock", note: "Payload too large" }, 413);
  }

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

  // Every asset we host for Perfect Corp to fetch is deleted as soon as the
  // try-on resolves — the user's photo must not outlive the request.
  const hosted: HostedAsset[] = [];
  try {
    const src = await hostUserPhoto(userPhotoDataUrl, base);
    hosted.push(src);
    const srcUrl = src.url;
    if (garmentImageDataUrl) {
      const ref = await hostUserPhoto(garmentImageDataUrl, base);
      hosted.push(ref);
      refUrl = ref.url;
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
        note: `Couldn't reach ${which} at a public URL — showing garment preview.`,
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
  } finally {
    await discardHosted(hosted);
  }
}

interface HostedAsset {
  url: string;
  /** Blob pathname, or an absolute local path in dev. */
  handle: string;
  kind: "blob" | "local";
}

/** Best-effort deletion of every image we uploaded for this request. */
async function discardHosted(assets: HostedAsset[]): Promise<void> {
  await Promise.all(
    assets.map(async (a) => {
      try {
        if (a.kind === "blob") await del(a.url);
        else await unlink(a.handle);
      } catch {
        /* cleanup is best-effort; never fail the response over it */
      }
    }),
  );
}

/** Decodes a base64 data URL and returns a publicly-reachable https URL. */
async function hostUserPhoto(dataUrl: string, base: string): Promise<HostedAsset> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("invalid data URL");
  const mime = match[1];
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";

  // Reject before decoding: base64 inflates ~4/3, so check the encoded length.
  if (match[2].length > MAX_IMAGE_BYTES * 1.4) {
    throw new Error("image exceeds the 5 MB limit");
  }
  const buf = Buffer.from(match[2], "base64");
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("image exceeds the 5 MB limit");
  }
  const filename = `user-${randomUUID()}.${ext}`;

  if (hasBlob()) {
    const pathname = `tryon/${filename}`;
    const { url } = await put(pathname, buf, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return { url, handle: pathname, kind: "blob" };
  }

  // Local-dev fallback: persist under /public/uploads and serve via the tunnel.
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, buf);
  return { url: `${base}/uploads/${filename}`, handle: filePath, kind: "local" };
}

function json(
  body: TryOnResponse,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
