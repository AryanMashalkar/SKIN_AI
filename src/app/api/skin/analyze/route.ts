import { NextRequest } from "next/server";
import { hasApiKey, runSkinAnalysis } from "@/lib/perfectcorp";
import { normalizeApiResult, type SkinProfile } from "@/lib/skin";
import { analyzeAppearance } from "@/lib/season";
import { check, clientKey, rateLimitHeaders, RULES } from "@/lib/rate-limit";
import { mockSkinProfile } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps serverless functions at 60s. The poll budget in
// `perfectcorp.ts` is sized to return a real response inside this window.
export const maxDuration = 60;

/** Hard cap on the uploaded selfie (5 MB); the client downscales well below. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface AnalyzeResponse {
  profile: SkinProfile;
  source: "perfectcorp" | "mock";
  note?: string;
}

export async function POST(request: NextRequest) {
  // This route spends paid Perfect Corp credits for anyone who can reach it.
  const rl = check(`skin:${clientKey(request)}`, RULES.skinAnalyze);
  if (!rl.ok) {
    return json(
      {
        profile: mockSkinProfile(),
        source: "mock",
        note: `Too many scans just now — try again in ${rl.retryAfter}s.`,
      },
      429,
      rateLimitHeaders(rl),
    );
  }

  let file: File | null = null;
  let skinHex: string | null = null;
  let hairHex: string | null = null;
  let eyeHex: string | null = null;
  let skinConfident = true;
  const hex = (v: FormDataEntryValue | null) =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
  try {
    const form = await request.formData();
    const value = form.get("image");
    if (value instanceof File) file = value;
    skinHex = hex(form.get("skinHex"));
    hairHex = hex(form.get("hairHex"));
    eyeHex = hex(form.get("eyeHex"));
    if (form.get("skinConfident") === "false") skinConfident = false;
  } catch {
    // no/invalid form body
  }

  // Attach the personal-colour analysis. Skin colour is sampled in the browser
  // (from the face region of the scan photo) and passed as `skinHex`; hair and
  // eye colour are optionally supplied by the user. All three feed the
  // three-axis season model — the server stays pure, no native image decoding.
  function withTone(profile: SkinProfile): SkinProfile {
    if (skinHex) {
      try {
        profile.tone = {
          ...analyzeAppearance({
            skin: skinHex,
            hair: hairHex ?? undefined,
            eye: eyeHex ?? undefined,
          }),
          lowConfidence: !skinConfident,
        };
      } catch {
        /* tone is optional */
      }
    }
    return profile;
  }

  // No API key configured -> mock concern scores, but still attach the REAL
  // sampled skin tone so the personal-colour flow works.
  if (!hasApiKey()) {
    return json({
      profile: withTone(mockSkinProfile()),
      source: "mock",
      note: "PERFECTCORP_API_KEY not set — simulated concern scores; skin tone measured from your photo.",
    });
  }

  if (!file) {
    return json(
      { profile: mockSkinProfile(), source: "mock", note: "No image received." },
      400,
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return json(
        {
          profile: withTone(mockSkinProfile()),
          source: "mock",
          note: "That photo is larger than 5 MB — please use a smaller image.",
        },
        413,
      );
    }
    // Only forward a content type we actually accept, rather than echoing the
    // client-supplied value straight into the upstream file-register call.
    const contentType = ACCEPTED_TYPES.includes(file.type) ? file.type : "image/jpeg";
    const fileName = "scan.jpg";
    const raw = await runSkinAnalysis(bytes, fileName, contentType);
    const profile = withTone(normalizeApiResult(raw));
    return json({ profile, source: "perfectcorp" });
  } catch (err) {
    // Live call failed — never break the demo, fall back to mock scores but
    // keep the real sampled tone.
    const message = err instanceof Error ? err.message : "unknown error";
    return json({
      profile: withTone(mockSkinProfile()),
      source: "mock",
      note: `Live analysis failed (${message}) — showing simulated scores; skin tone measured from your photo.`,
    });
  }
}

function json(
  body: AnalyzeResponse,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
