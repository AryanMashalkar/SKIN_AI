import { NextRequest } from "next/server";
import { hasApiKey, runSkinAnalysis } from "@/lib/perfectcorp";
import { normalizeApiResult, type SkinProfile } from "@/lib/skin";
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

  // No API key configured -> deterministic mock so the storefront is always
  // demoable. This is the expected path until PERFECTCORP_API_KEY is set.
  if (!hasApiKey()) {
    return json({
      profile: mockSkinProfile(),
      source: "mock",
      note: "PERFECTCORP_API_KEY not set — returning simulated analysis.",
    });
  }

  if (!file) {
    return json(
      {
        profile: mockSkinProfile(),
        source: "mock",
        note: "No image received.",
      },
      400,
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || "image/jpeg";
    const fileName = file.name || "scan.jpg";
    const raw = await runSkinAnalysis(bytes, fileName, contentType);
    const profile = normalizeApiResult(raw);
    return json({ profile, source: "perfectcorp" });
  } catch (err) {
    // Live call failed — never break the demo, fall back to a mock result.
    const message = err instanceof Error ? err.message : "unknown error";
    return json({
      profile: mockSkinProfile(),
      source: "mock",
      note: `Live analysis failed (${message}) — showing simulated result.`,
    });
  }
}

function json(body: AnalyzeResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
