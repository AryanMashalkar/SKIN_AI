// Server-only: the occasion stylist's agent loop, on Groq.
//
// The model gets the measured scan up front, then works through two tools
// (lib/agent/tools.ts): find_pieces (catalogue pieces for the occasion, each
// with its colourways already ranked for this scan) and propose_look. It plans
// and writes the "why"; it never produces a measurement. proposeLook validates
// the look (real ids, no clashing colourway, within budget) and the loop ends
// only on a look that passes.
//
// Token budget drives the shape: Groq's free tier allows ~8K tokens a minute,
// and every turn resends the conversation, so a run is designed to take two
// model calls with compact tool output. Identical requests are cached, and a
// 429 is retried once when Groq's retry-after fits the time budget.
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
import { REDNESS_ELEVATED_BELOW } from "@/lib/fashion/styling";
import {
  readScan,
  findPieces,
  proposeLook,
  planWithoutModel,
  type Look,
  type ProposeInput,
  type ToolResult,
  type TraceStep,
} from "@/lib/agent/tools";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const MODEL = "openai/gpt-oss-120b";
const MAX_TURNS = 6;
/** Leave headroom under the route's 60s maxDuration for the fallback. */
const TIME_BUDGET_MS = 45_000;
/** Longest Groq retry-after (seconds) worth waiting for inside one request. */
const MAX_RETRY_WAIT_S = 12;

export function hasAgentKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

const SYSTEM = `You are MIROIR's occasion stylist. Build a look from this store's catalogue for the shopper's occasion, in colours their measured skin scan says suit them.

Steps:
1. Call find_pieces for the occasion closest to the brief (${OCCASIONS.join(", ")}); try a second occasion only if the first returns nothing usable. Each piece comes with its colourways ranked for this shopper: verdict, fit 0-100, and red=true for a red colour while redness is flagged.
2. Call propose_look with 1-3 pieces (at most one Outerwear). Pick high-fit colourways; never a "clash"; avoid red=true when another colour works. If rejected, fix what the error says and call propose_look again. Always end with propose_look, never plain text.

Rules:
- Never state a measurement the tools did not return.
- Prices are USD. Set budget_usd only for a dollar budget; for any other currency leave it out and say in the note that it was not converted.
- If redness is flagged, say in the note that reds were kept away from the face.
- If nothing in the catalogue suits the occasion, say so in the note rather than stretching a piece.
- headline under 8 words; note at most two sentences; "why" one short sentence per piece.`;

// Plain schemas (no nullable unions): optional fields are simply omitted.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "find_pieces",
      description:
        "Catalogue pieces for an occasion (optionally under a USD max price), each with its colourways ranked for this shopper.",
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
    readonly retryAfterS: number | null = null,
  ) {
    super(`Groq API returned ${status}`);
  }
}

async function callGroqOnce(messages: ChatMessage[], deadline: number): Promise<ChatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        // gpt-oss is a reasoning model. Choosing pieces from ranked data is an
        // easy decision, and every token counts against the per-minute limit,
        // so keep reasoning low, cap the reply at Groq's recommended 1024
        // tokens, and don't ship the reasoning text back (it is never shown).
        reasoning_effort: "low",
        max_completion_tokens: 1024,
        include_reasoning: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Groq explains a 400 in the body (e.g. tool_use_failed when the model
      // emits a malformed call); keep a short copy for the server log only.
      // On a 429, Groq's headers say which limit was hit (per-minute tokens vs
      // daily requests) and when it resets.
      const limits = ["retry-after", "x-ratelimit-remaining-requests", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-requests", "x-ratelimit-reset-tokens"]
        .map((h) => `${h}=${res.headers.get(h) ?? "-"}`)
        .join(" ");
      const detail = `${limits} ${(await res.text().catch(() => "")).slice(0, 400)}`;
      const retryAfter = Number(res.headers.get("retry-after"));
      throw new GroqError(res.status, detail, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
    }
    return (await res.json()) as ChatResponse;
  } finally {
    clearTimeout(timer);
  }
}

/** One retry on a rate limit, when Groq's wait fits inside the time budget. */
async function callGroq(messages: ChatMessage[], deadline: number): Promise<ChatResponse> {
  try {
    return await callGroqOnce(messages, deadline);
  } catch (err) {
    const wait = err instanceof GroqError && err.status === 429 ? err.retryAfterS : null;
    if (wait === null || wait > MAX_RETRY_WAIT_S || Date.now() + wait * 1000 + 5_000 > deadline) throw err;
    await new Promise((r) => setTimeout(r, wait * 1000));
    return callGroqOnce(messages, deadline);
  }
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

// ---- cache ----------------------------------------------------------------------
// A look depends only on the brief, the season palette and the redness flag,
// so judges tapping the same example chip reuse one AI run. Per instance and
// in memory: a cache miss just costs a normal run.

const CACHE_MAX = 50;
const cache = new Map<string, Look>();

function cacheKey(profile: SkinProfile, brief: string): string | null {
  if (!profile.tone) return null;
  const redness = profile.scores.redness < REDNESS_ELEVATED_BELOW;
  return `${profile.tone.season}|${redness}|${brief.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function remember(key: string | null, look: Look): void {
  if (!key) return;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, look);
}

// ---- loop ------------------------------------------------------------------------

export async function runOccasionAgent(profile: SkinProfile, brief: string): Promise<AgentOutcome> {
  if (!hasAgentKey()) return fallback(profile, brief, "AI stylist is off (no GROQ_API_KEY).");

  const key = cacheKey(profile, brief);
  const cached = key ? cache.get(key) : undefined;
  if (cached) return { look: cached };

  // The scan is read server-side and handed over measured, saving a turn.
  const scan = readScan(profile);
  if (!scan.ok) return { look: null, error: scan.error };
  const trace: TraceStep[] = [{ tool: "read_scan", input: {}, summary: summariseScan(scan) }];

  const deadline = Date.now() + TIME_BUDGET_MS;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Measured scan: ${JSON.stringify(scan.data)}\nOccasion brief: ${brief}`,
    },
  ];
  let nudged = false;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (Date.now() > deadline) return fallback(profile, brief, "The stylist ran out of time.");

      const reply = (await callGroq(messages, deadline)).choices?.[0]?.message;
      if (!reply) return fallback(profile, brief, "The AI stylist returned nothing.");
      messages.push({ role: "assistant", content: reply.content ?? "", tool_calls: reply.tool_calls });

      const calls = reply.tool_calls ?? [];
      if (calls.length === 0) {
        // Answered in plain text: one nudge back to the tools, then give up.
        if (!nudged) {
          nudged = true;
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
            const look: Look = { ...proposed.look, source: "ai", trace };
            remember(key, look);
            return { look };
          }
          answer(JSON.stringify({ error: proposed.error }));
          continue;
        }

        let result: ToolResult;
        if (name === "find_pieces") {
          const occasion = typeof args.occasion === "string" && args.occasion !== "any" ? args.occasion : null;
          const maxPrice = typeof args.max_price === "number" ? args.max_price : null;
          result = findPieces(profile, { occasion, max_price: maxPrice });
        } else {
          result = { ok: false, error: `Unknown tool ${name}. Use find_pieces or propose_look.` };
        }
        trace.push({
          tool: name,
          input: args,
          summary: result.ok
            ? `${(result.data as unknown[]).length} pieces, colours ranked`
            : `Rejected: ${result.error}`,
        });
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

function summariseScan(scan: ToolResult): string {
  if (!scan.ok) return `Rejected: ${scan.error}`;
  const d = scan.data as { season: string; redness_flagged: boolean };
  return `${d.season}${d.redness_flagged ? ", redness flagged" : ""}`;
}
