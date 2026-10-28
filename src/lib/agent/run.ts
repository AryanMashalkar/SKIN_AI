// Server-only: the occasion stylist's agent loop.
//
// Claude reads the brief, then works through the same tools the rules planner
// uses (lib/agent/tools.ts): read the scan, search the catalogue for the
// occasion, rank each candidate's colourways, and propose a look. It plans and
// writes the "why"; it never produces a measurement. proposeLook validates the
// look (real ids, no clashing colourway, within budget) and the loop ends only
// on a look that passes.
//
// Any failure (no key, API error, refusal, time budget) falls back to the
// rules planner with a labelled note, so the demo never breaks.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SkinProfile } from "@/lib/skin";
import { OCCASIONS } from "@/lib/fashion/products";
import {
  readScan,
  searchCatalog,
  rankColours,
  proposeLook,
  planWithoutModel,
  type Look,
  type ProposeInput,
  type ToolResult,
  type TraceStep,
} from "@/lib/agent/tools";

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 8;
/** Leave headroom under the route's 60s maxDuration for the fallback. */
const TIME_BUDGET_MS = 45_000;

export function hasAgentKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const SYSTEM = `You are MIROIR's occasion stylist. A shopper describes an occasion (and maybe a budget); you build them a look from this store's catalogue, in the colours their skin scan says suit them.

Work only through the tools:
1. read_scan - their measured colour season, palette, and whether redness is flagged today.
2. search_catalog - pieces for the occasion. Occasions are: ${OCCASIONS.join(", ")}. Map the brief to the closest one; search a second occasion if the first returns little.
3. rank_colours - for each piece you are considering. Prefer the colourway ranked best; never choose one whose verdict is "clash".
4. propose_look - one to three pieces that work together (at most one outerwear layer). If it is rejected, fix what the error says and propose again.

Rules:
- Every fit score, colour distance and verdict comes from the tools. Never state a measurement the tools did not return.
- Prices are in USD. If the budget is in another currency, set budget_usd to null and say in the note that you did not convert it.
- If redness is flagged, keep red and orange colourways away from the face and say why in the note.
- If the catalogue has nothing suitable for the occasion, say so plainly in the note instead of stretching a piece to fit.
- "why" is one short sentence per piece about the occasion and styling. The headline is under 8 words. The note is at most two sentences.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "read_scan",
    description:
      "Read the shopper's skin scan: colour season, palette colour names, season confidence, and whether redness is flagged on this scan. Call this first.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "search_catalog",
    description:
      "List catalogue pieces for an occasion, optionally under a max price in USD. Returns ids, prices, occasions and colourway names.",
    input_schema: {
      type: "object",
      properties: {
        occasion: { type: ["string", "null"], enum: [...OCCASIONS, null] },
        max_price: { type: ["number", "null"] },
      },
      required: ["occasion", "max_price"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "rank_colours",
    description:
      "Rank one garment's colourways against the shopper's palette: verdict (best/good/workable/clash), fit 0-100, colour distance, and a measured reason.",
    input_schema: {
      type: "object",
      properties: { garment_id: { type: "string" } },
      required: ["garment_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "propose_look",
    description:
      "Submit the final look. The store validates ids, rejects clashing colourways and looks over budget, and computes the total itself.",
    input_schema: {
      type: "object",
      properties: {
        headline: { type: "string" },
        note: { type: "string" },
        budget_usd: { type: ["number", "null"] },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              garment_id: { type: "string" },
              colourway_id: { type: "string" },
              why: { type: "string" },
            },
            required: ["garment_id", "colourway_id", "why"],
            additionalProperties: false,
          },
        },
      },
      required: ["headline", "note", "budget_usd", "items"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function summarise(name: string, result: ToolResult): string {
  if (!result.ok) return `Rejected: ${result.error}`;
  const data = result.data as Record<string, unknown> | unknown[];
  if (name === "read_scan") {
    const d = data as { season: string; redness_flagged: boolean };
    return `${d.season}${d.redness_flagged ? ", redness flagged" : ""}`;
  }
  if (name === "search_catalog") {
    const n = (data as unknown[]).length;
    return `${n} ${n === 1 ? "piece" : "pieces"} found`;
  }
  if (name === "rank_colours") {
    const top = (data as { colour: string; verdict: string; fit: number }[])[0];
    return top ? `Top: ${top.colour} (${top.verdict}, fit ${top.fit})` : "No colourways";
  }
  return "Done";
}

export interface AgentOutcome {
  look: Look | null;
  error?: string;
  /** Why the rules planner ran instead of Claude, when it did. */
  fellBack?: string;
}

function fallback(profile: SkinProfile, brief: string, reason: string): AgentOutcome {
  const planned = planWithoutModel(profile, brief);
  if ("error" in planned) return { look: null, error: planned.error, fellBack: reason };
  return {
    look: { ...planned, note: `${reason} Rules planned this instead: ${planned.note.charAt(0).toLowerCase()}${planned.note.slice(1)}` },
    fellBack: reason,
  };
}

export async function runOccasionAgent(profile: SkinProfile, brief: string): Promise<AgentOutcome> {
  if (!hasAgentKey()) return fallback(profile, brief, "AI stylist is off (no ANTHROPIC_API_KEY).");

  const client = new Anthropic();
  const started = Date.now();
  const trace: TraceStep[] = [];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Occasion brief: ${brief}` },
  ];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        return fallback(profile, brief, "The stylist ran out of time.");
      }

      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        tools: TOOLS,
        messages,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      if (response.stop_reason === "refusal") {
        return fallback(profile, brief, "The stylist declined this brief.");
      }
      messages.push({ role: "assistant", content: response.content });

      const calls = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      if (calls.length === 0) {
        // Ended without an accepted look: surface what it said.
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join(" ")
          .trim();
        return { look: null, error: text || "The stylist did not propose a look." };
      }

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        const input = (call.input ?? {}) as Record<string, unknown>;
        if (call.name === "propose_look") {
          const proposed = proposeLook(profile, input as unknown as ProposeInput);
          trace.push({
            tool: call.name,
            input: { items: (input.items as unknown[] | undefined)?.length ?? 0 },
            summary: proposed.ok ? `Accepted, $${proposed.look.total}` : `Rejected: ${proposed.error}`,
          });
          if (proposed.ok) return { look: { ...proposed.look, source: "claude", trace } };
          results.push({ type: "tool_result", tool_use_id: call.id, content: proposed.error, is_error: true });
          continue;
        }

        const result =
          call.name === "read_scan"
            ? readScan(profile)
            : call.name === "search_catalog"
              ? searchCatalog(input as { occasion?: string | null; max_price?: number | null })
              : call.name === "rank_colours"
                ? rankColours(profile, input as { garment_id: string })
                : ({ ok: false, error: `Unknown tool ${call.name}` } as ToolResult);
        trace.push({ tool: call.name, input, summary: summarise(call.name, result) });
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result.ok ? result.data : { error: result.error }),
          is_error: !result.ok,
        });
      }
      // All results for one assistant turn go back in a single user message.
      messages.push({ role: "user", content: results });
    }
    return fallback(profile, brief, "The stylist did not settle on a look.");
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return fallback(profile, brief, "The AI stylist is busy right now.");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return fallback(profile, brief, "The AI key was rejected.");
    }
    if (err instanceof Anthropic.APIError) {
      return fallback(profile, brief, `The AI stylist is unavailable (${err.status ?? "network"}).`);
    }
    throw err;
  }
}
