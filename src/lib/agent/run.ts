// Server-only: the occasion stylist's agent loop, on Groq.
//
// The model reads the brief, then works through the same tools the rules
// planner uses (lib/agent/tools.ts): read the scan, search the catalogue for
// the occasion, rank each candidate's colourways, and propose a look. It plans
// and writes the "why"; it never produces a measurement. proposeLook validates
// the look (real ids, no clashing colourway, within budget) and the loop ends
// only on a look that passes.
//
// Groq serves an OpenAI-compatible chat-completions API: tool calls arrive as
// `message.tool_calls`, and each result goes back as a `role: "tool"` message
// carrying the call's id.
//
// Any failure (no key, API error, time budget) falls back to the rules planner
// with a labelled note, so the demo never breaks.

import "server-only";
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

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const MODEL = "openai/gpt-oss-120b";
const MAX_TURNS = 10;
/** Leave headroom under the route's 60s maxDuration for the fallback. */
const TIME_BUDGET_MS = 45_000;

export function hasAgentKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

const SYSTEM = `You are MIROIR's occasion stylist. A shopper describes an occasion (and maybe a budget); you build them a look from this store's catalogue, in the colours their skin scan says suit them.

Work only through the tools:
1. read_scan - their measured colour season, palette, and whether redness is flagged today.
2. search_catalog - pieces for the occasion. Occasions are: ${OCCASIONS.join(", ")}. Map the brief to the closest one; search a second occasion if the first returns little.
3. rank_colours - for each piece you are considering. Prefer the colourway ranked best; never choose one whose verdict is "clash". If red_near_flagged_redness is true, prefer another colourway.
4. propose_look - one to three pieces that work together (at most one outerwear layer). If it is rejected, fix what the error says and propose again. Always finish by calling propose_look; do not answer in plain text.

Rules:
- Every fit score, colour distance and verdict comes from the tools. Never state a measurement the tools did not return.
- Prices are in USD. Only set budget_usd when the shopper gave a budget in dollars; if it was in another currency, leave budget_usd out and say in the note that you did not convert it.
- If redness is flagged, keep red and orange colourways away from the face and say why in the note.
- If the catalogue has nothing suitable for the occasion, say so plainly in the note instead of stretching a piece to fit.
- "why" is one short sentence per piece about the occasion and styling. The headline is under 8 words. The note is at most two sentences.`;

// Plain schemas (no nullable unions): optional fields are simply omitted.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_scan",
      description:
        "Read the shopper's skin scan: colour season, palette colour names, season confidence, and whether redness is flagged on this scan. Call this first.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_catalog",
      description:
        "List catalogue pieces for an occasion, optionally under a max price in USD. Returns ids, prices, occasions and colourway names.",
      parameters: {
        type: "object",
        properties: {
          occasion: { type: "string", enum: [...OCCASIONS, "any"] },
          max_price: { type: "number", description: "USD. Omit for no limit." },
        },
        required: ["occasion"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_colours",
      description:
        "Rank one garment's colourways against the shopper's palette: verdict (best/good/workable/clash), fit 0-100, colour distance, red flag, and a measured reason.",
      parameters: {
        type: "object",
        properties: { garment_id: { type: "string" } },
        required: ["garment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_look",
      description:
        "Submit the final look. The store validates ids, rejects clashing colourways and looks over budget, and computes the total itself.",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string" },
          note: { type: "string" },
          budget_usd: { type: "number", description: "Only when the shopper gave a USD budget." },
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
            },
          },
        },
        required: ["headline", "note", "items"],
      },
    },
  },
];

/** The parts of a chat-completions reply this loop reads. */
interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
interface ChatResponse {
  choices?: { message: ChatMessage; finish_reason: string }[];
}

class GroqError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Groq API returned ${status}`);
  }
}

async function callGroq(messages: ChatMessage[], deadline: number): Promise<ChatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Groq explains a 400 in the body (e.g. tool_use_failed when the model
      // emits a malformed call); keep a short copy for the server log only.
      const detail = (await res.text().catch(() => "")).slice(0, 400);
      throw new GroqError(res.status, detail);
    }
    return (await res.json()) as ChatResponse;
  } finally {
    clearTimeout(timer);
  }
}

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

/** Parses a tool call's JSON arguments; a malformed call becomes a tool error. */
function parseArgs(raw: string | undefined): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export interface AgentOutcome {
  look: Look | null;
  error?: string;
  /** Why the rules planner ran instead of the model, when it did. */
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

function runTool(profile: SkinProfile, name: string, args: Record<string, unknown>): ToolResult {
  if (name === "read_scan") return readScan(profile);
  if (name === "search_catalog") {
    const occasion = typeof args.occasion === "string" && args.occasion !== "any" ? args.occasion : null;
    const maxPrice = typeof args.max_price === "number" ? args.max_price : null;
    return searchCatalog({ occasion, max_price: maxPrice });
  }
  if (name === "rank_colours") return rankColours(profile, { garment_id: String(args.garment_id ?? "") });
  return { ok: false, error: `Unknown tool ${name}` };
}

export async function runOccasionAgent(profile: SkinProfile, brief: string): Promise<AgentOutcome> {
  if (!hasAgentKey()) return fallback(profile, brief, "AI stylist is off (no GROQ_API_KEY).");

  const deadline = Date.now() + TIME_BUDGET_MS;
  const trace: TraceStep[] = [];
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Occasion brief: ${brief}` },
  ];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (Date.now() > deadline) return fallback(profile, brief, "The stylist ran out of time.");

      const reply = (await callGroq(messages, deadline)).choices?.[0]?.message;
      if (!reply) return fallback(profile, brief, "The AI stylist returned nothing.");
      messages.push({ role: "assistant", content: reply.content ?? "", tool_calls: reply.tool_calls });

      const calls = reply.tool_calls ?? [];
      if (calls.length === 0) {
        // Ended without an accepted look: one nudge back to the tools, then give up.
        if (turn < MAX_TURNS - 1 && !trace.some((s) => s.tool === "nudge")) {
          trace.push({ tool: "nudge", input: {}, summary: "Asked to finish with propose_look" });
          messages.push({ role: "user", content: "Finish by calling propose_look with your look." });
          continue;
        }
        return fallback(profile, brief, "The stylist did not propose a look.");
      }

      for (const call of calls) {
        const name = call.function?.name ?? "";
        const args = parseArgs(call.function?.arguments);
        const answer = (content: string) =>
          messages.push({ role: "tool", tool_call_id: call.id, name, content });

        if (!args) {
          trace.push({ tool: name, input: {}, summary: "Rejected: arguments were not valid JSON" });
          answer(JSON.stringify({ error: "Arguments were not valid JSON. Call the tool again." }));
          continue;
        }

        if (name === "propose_look") {
          const input: ProposeInput = {
            headline: String(args.headline ?? ""),
            note: String(args.note ?? ""),
            budget_usd: typeof args.budget_usd === "number" ? args.budget_usd : null,
            items: Array.isArray(args.items) ? (args.items as ProposeInput["items"]) : [],
          };
          const proposed = proposeLook(profile, input);
          trace.push({
            tool: name,
            input: { items: input.items.length },
            summary: proposed.ok ? `Accepted, $${proposed.look.total}` : `Rejected: ${proposed.error}`,
          });
          if (proposed.ok) {
            return { look: { ...proposed.look, source: "ai", trace: trace.filter((s) => s.tool !== "nudge") } };
          }
          answer(JSON.stringify({ error: proposed.error }));
          continue;
        }

        const result = runTool(profile, name, args);
        trace.push({ tool: name, input: args, summary: summarise(name, result) });
        answer(JSON.stringify(result.ok ? result.data : { error: result.error }));
      }
    }
    return fallback(profile, brief, "The stylist did not settle on a look.");
  } catch (err) {
    if (err instanceof GroqError) {
      console.error(`[agent] Groq ${err.status}: ${err.detail}`);
      if (err.status === 401 || err.status === 403) return fallback(profile, brief, "The AI key was rejected.");
      if (err.status === 429) return fallback(profile, brief, "The AI stylist is busy right now.");
      return fallback(profile, brief, `The AI stylist is unavailable (${err.status}).`);
    }
    if (err instanceof Error && err.name === "AbortError") {
      return fallback(profile, brief, "The stylist ran out of time.");
    }
    // Network failure or a malformed reply: never break the demo over it.
    return fallback(profile, brief, "The AI stylist is unavailable right now.");
  }
}
