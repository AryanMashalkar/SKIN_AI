// Occasion stylist: { brief, profile } -> a validated look.
//
// The profile is the shopper's own scan, held in their browser; the server
// only reads it. Rate limited like the other paid routes, because each call
// can spend model tokens.

import { NextRequest, NextResponse } from "next/server";
import { runOccasionAgent } from "@/lib/agent/run";
import { check, clientKey, rateLimitHeaders, RULES } from "@/lib/rate-limit";
import type { SkinProfile } from "@/lib/skin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BRIEF_CHARS = 400;

function isProfile(v: unknown): v is SkinProfile {
  const p = v as SkinProfile | null;
  return Boolean(p && typeof p === "object" && p.scores && typeof p.scores.redness === "number");
}

export async function POST(req: NextRequest) {
  const rl = check(`agent:${clientKey(req)}`, RULES.agent);
  if (!rl.ok) {
    return NextResponse.json(
      { look: null, error: `Too many requests just now — try again in ${rl.retryAfter}s.` },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { brief?: unknown; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ look: null, error: "Invalid body" }, { status: 400 });
  }

  const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, MAX_BRIEF_CHARS) : "";
  if (!brief) {
    return NextResponse.json({ look: null, error: "Describe the occasion first." }, { status: 400 });
  }
  if (!isProfile(body.profile)) {
    return NextResponse.json({ look: null, error: "Scan your skin first." }, { status: 400 });
  }

  const outcome = await runOccasionAgent(body.profile, brief);
  return NextResponse.json(outcome, { headers: rateLimitHeaders(rl) });
}
