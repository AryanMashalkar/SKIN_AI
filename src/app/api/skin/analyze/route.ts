import { NextRequest } from "next/server";
import { hasApiKey, runSkinAnalysis } from "@/lib/perfectcorp";
import { runToneAnalysis, type MeasuredColours } from "@/lib/tone-api";
import { normalizeApiResult, type SkinProfile } from "@/lib/skin";
import { resolveTone } from "@/lib/tone-crosscheck";
import { check, clientKey, rateLimitHeaders, RULES } from "@/lib/rate-limit";
import { mockSkinProfile } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps serverless functions at 60s. The poll budget in
// `perfectcorp.ts` is sized to return a real response inside this window.
export const maxDuration = 60;

/** Hard cap on the uploaded selfie; matches MAX_UPLOAD_BYTES, just under Vercel's 4.5 MB body limit. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** The Facial Color Tones Analyzer takes jpg/png only. */
const TONE_TYPES = ["image/jpeg", "image/png"];

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

  // Attach the personal-colour analysis. Skin colour is the in-browser,
  // white-balanced sample of the face (`skinHex`), cross-checked against
  // YouCam's Facial Color Tones Analyzer (`measured`) when that ran; hair and
  // eye colour come from YouCam when available, else the swatches the user
  // picked. See lib/tone-crosscheck.ts for why the photo sample leads. The
  // server stays pure, no native image decoding.
  function withTone(profile: SkinProfile, measured: MeasuredColours | null = null): SkinProfile {
    const fromYouCam = Boolean(measured?.hair || measured?.eye);
    try {
      const tone = resolveTone({
        photoSkin: skinHex,
        photoConfident: skinConfident,
        youcamSkin: measured?.skin,
        youcamLighting: measured?.lighting,
        hair: measured?.hair ?? hairHex ?? undefined,
        eye: measured?.eye ?? eyeHex ?? undefined,
        hairEyeBy: fromYouCam ? "youcam" : "swatches",
      });
      if (tone) profile.tone = tone;
    } catch {
      /* tone is optional */
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
          note: "That photo is larger than 4 MB — please use a smaller image.",
        },
        413,
      );
    }
    // Only forward a content type we actually accept, rather than echoing the
    // client-supplied value straight into the upstream file-register call.
    const contentType = ACCEPTED_TYPES.includes(file.type) ? file.type : "image/jpeg";

    // Both YouCam analyses run in parallel, so measuring colour adds no wait.
    // Either can fail on its own: concern scores fall back to simulated ones,
    // colours fall back to the in-browser sample.
    const [skinRun, toneRun] = await Promise.allSettled([
      runSkinAnalysis(bytes, "scan.jpg", contentType),
      TONE_TYPES.includes(contentType)
        ? runToneAnalysis(bytes, contentType)
        : Promise.reject(new Error(`tone analysis does not accept ${contentType}`)),
    ]);
    const measured = toneRun.status === "fulfilled" ? toneRun.value : null;
    if (toneRun.status === "rejected") {
      console.error(`[analyze] tone analysis failed, using the photo sample: ${String(toneRun.reason)}`);
    }

    if (skinRun.status === "fulfilled") {
      return json({ profile: withTone(normalizeApiResult(skinRun.value), measured), source: "perfectcorp" });
    }
    // Skin Analysis failed — never break the demo: simulated concern scores,
    // but a real colour reading.
    const reason = skinRun.reason;
    const message = reason instanceof Error ? reason.message : "unknown error";
    console.error(`[analyze] skin analysis failed, showing simulated scores: ${message}`);
    return json({
      profile: { ...withTone(mockSkinProfile(), measured), demoReason: friendlyReason(message) },
      source: "mock",
      note: `Live analysis failed (${message}) — showing simulated scores; colours ${measured ? "measured by YouCam" : "measured from your photo"}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return json({
      profile: withTone(mockSkinProfile()),
      source: "mock",
      note: `Live analysis failed (${message}) — showing simulated scores; skin tone measured from your photo.`,
    });
  }
}

/**
 * A shopper-readable version of a Skin Analysis failure. YouCam's error codes
 * (e.g. `error_src_face_too_small`) are kept in brackets so a judge or the
 * developer can still see the real cause.
 */
function friendlyReason(message: string): string {
  const code = message.match(/error_[a-z_]+|[A-Z][a-zA-Z]+(?:Insufficiency|Parameters)/)?.[0];
  const hint =
    code && /face_too_small|face_area|src_face/.test(code)
      ? "Your face was too small in the photo — use a close-up selfie where your face fills most of the frame."
      : code && /no_face/.test(code)
        ? "No face was found — face the camera in good light."
        : code && /CreditInsufficiency/.test(code)
          ? "The YouCam account is out of units."
          : /timed out/.test(message)
            ? "YouCam took too long to answer — try again."
            : "The live skin analysis didn't complete — try another photo.";
  return code ? `${hint} (${code})` : hint;
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
