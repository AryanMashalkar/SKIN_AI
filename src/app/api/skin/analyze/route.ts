import { NextRequest } from "next/server";
import { hasApiKey, runSkinAnalysis } from "@/lib/perfectcorp";
import { normalizeApiResult, type SkinProfile } from "@/lib/skin";
import { analyzeSkinTone } from "@/lib/color";
import { mockSkinProfile } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AnalyzeResponse {
  profile: SkinProfile;
  source: "perfectcorp" | "mock";
  note?: string;
}

export async function POST(request: NextRequest) {
  let file: File | null = null;
  let skinHex: string | null = null;
  let skinConfident = true;
  try {
    const form = await request.formData();
    const value = form.get("image");
    if (value instanceof File) file = value;
    const hex = form.get("skinHex");
    if (typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex)) skinHex = hex;
    if (form.get("skinConfident") === "false") skinConfident = false;
  } catch {
    // no/invalid form body
  }

  // Attach the personal-colour analysis. The skin colour is sampled in the
  // browser (from the face region of the scan photo) and passed as `skinHex`,
  // so the server stays pure — no native image decoding.
  function withTone(profile: SkinProfile): SkinProfile {
    if (skinHex) {
      try {
        profile.tone = { ...analyzeSkinTone(skinHex), lowConfidence: !skinConfident };
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
    const contentType = file.type || "image/jpeg";
    const fileName = file.name || "scan.jpg";
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

function json(body: AnalyzeResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
