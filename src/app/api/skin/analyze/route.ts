import { NextRequest } from "next/server";
import { hasApiKey, runSkinAnalysis } from "@/lib/perfectcorp";
import { normalizeApiResult, type SkinProfile } from "@/lib/skin";
import { sampleSkinTone } from "@/lib/skinTone";
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
  try {
    const form = await request.formData();
    const value = form.get("image");
    if (value instanceof File) file = value;
  } catch {
    // no/invalid form body
  }

  // Read the bytes once (used for both the skin analysis and the personal-
  // colour sampling). The tone analysis runs on the user's real selfie even
  // when the concern scores are mocked, so the colour story is always live.
  let bytes: Uint8Array | null = null;
  if (file) {
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      /* leave bytes null */
    }
  }

  async function withTone(profile: SkinProfile): Promise<SkinProfile> {
    if (bytes) {
      try {
        profile.tone = await sampleSkinTone(bytes);
        return profile;
      } catch {
        /* fall through to synthetic tone */
      }
    }
    return profile;
  }

  // No API key configured -> mock concern scores, but still sample the REAL
  // skin tone from the uploaded photo so the personal-colour flow works.
  if (!hasApiKey()) {
    return json({
      profile: await withTone(mockSkinProfile()),
      source: "mock",
      note: "PERFECTCORP_API_KEY not set — simulated concern scores; skin tone is measured from your photo.",
    });
  }

  if (!file || !bytes) {
    return json(
      { profile: mockSkinProfile(), source: "mock", note: "No image received." },
      400,
    );
  }

  try {
    const contentType = file.type || "image/jpeg";
    const fileName = file.name || "scan.jpg";
    const raw = await runSkinAnalysis(bytes, fileName, contentType);
    const profile = await withTone(normalizeApiResult(raw));
    return json({ profile, source: "perfectcorp" });
  } catch (err) {
    // Live call failed — never break the demo, fall back to a mock result but
    // keep the real sampled tone.
    const message = err instanceof Error ? err.message : "unknown error";
    return json({
      profile: await withTone(mockSkinProfile()),
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
