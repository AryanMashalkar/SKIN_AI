// The recorded stress-test and pilot results, as published on /evidence.
// These are stored results, not computed per request: the selfies they came
// from are not in the repository. scripts/lighting-evidence.mjs produced them.

import { NextResponse } from "next/server";
import lighting from "../../../../data/evidence/lighting.json";
import pilot from "../../../../data/evidence/pilot.json";

export function GET() {
  const { allCases, ...lightingSummary } = lighting;
  const { allScans, ...pilotSummary } = pilot;
  return NextResponse.json({
    claim: "Stability and honest flagging only. Neither test measures whether a season is correct.",
    lighting: { ...lightingSummary, caseCount: allCases.length },
    pilot: { ...pilotSummary, scanCount: allScans.length },
    source: "https://github.com/AryanMashalkar/SKIN_AI/tree/main/data/evidence",
  });
}
