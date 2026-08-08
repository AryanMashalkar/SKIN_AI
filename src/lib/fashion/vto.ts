// Server-only Perfect Corp AI Clothes Virtual Try-On client (S2S API v2.0).
//
// Unlike Skin Analysis (presigned upload), the VTO API FETCHES both images
// from public URLs, so `src_file_url` (person) and `ref_file_url` (garment)
// must be reachable on the public internet (dev tunnel or deployed host).
//
//   POST /s2s/v2.0/task/cloth   { src_file_url, ref_file_url, garment_category, change_shoes }
//     -> { data: { task_id } }
//   GET  /s2s/v2.0/task/cloth/{task_id}  (poll)
//     -> { data: { task_status: "success", results: { url } } }
//
// Auth: `Authorization: Bearer <PERFECTCORP_API_KEY>`.

import "server-only";
import type { GarmentCategory } from "@/lib/fashion/products";

const BASE_URL =
  process.env.PERFECTCORP_VTO_BASE_URL ?? "https://yce-api-01.makeupar.com";
const CLOTH_ENDPOINT = "/s2s/v2.0/task/cloth";
const POLL_INTERVAL_MS = 2000;
/**
 * Wall-clock polling budget. The route declares `maxDuration = 60` (the Vercel
 * Hobby ceiling), so we must stop polling and return a real JSON response
 * *before* the platform kills the function — otherwise the user gets an opaque
 * 504 instead of the graceful garment-preview fallback. The remaining ~10s
 * covers task creation, the reachability pre-flight and blob cleanup.
 */
const POLL_BUDGET_MS = 48_000;

export function hasVtoKey(): boolean {
  return Boolean(process.env.PERFECTCORP_API_KEY);
}

function authHeaders(): Record<string, string> {
  const key = process.env.PERFECTCORP_API_KEY;
  if (!key) throw new Error("PERFECTCORP_API_KEY is not set");
  return { Authorization: `Bearer ${key}` };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readError(res: Response): Promise<string> {
  try {
    return `HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export interface ClothTryOnInput {
  srcUrl: string; // public URL of the person photo
  refUrl: string; // public URL of the garment image
  garmentCategory: GarmentCategory;
  changeShoes?: boolean;
}

/**
 * Runs a clothing virtual try-on and returns the generated image URL.
 * Throws on failure so the caller can decide whether to fall back.
 */
export async function runClothTryOn(input: ClothTryOnInput): Promise<string> {
  const startRes = await fetch(`${BASE_URL}${CLOTH_ENDPOINT}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      src_file_url: input.srcUrl,
      ref_file_url: input.refUrl,
      garment_category: input.garmentCategory,
      change_shoes: Boolean(input.changeShoes),
    }),
  });
  if (!startRes.ok) throw new Error(`cloth start failed: ${await readError(startRes)}`);

  const startJson = await startRes.json();
  // Some responses may already carry a result URL.
  const immediate = extractResultUrl(startJson);
  if (immediate) return immediate;

  const taskId: string | undefined =
    startJson?.data?.task_id ?? startJson?.data?.taskId ?? startJson?.task_id;
  if (!taskId) throw new Error("cloth start: missing task_id");

  const deadline = Date.now() + POLL_BUDGET_MS;
  while (Date.now() < deadline) {
    const pollRes = await fetch(
      `${BASE_URL}${CLOTH_ENDPOINT}/${encodeURIComponent(taskId)}`,
      { headers: authHeaders() },
    );
    if (!pollRes.ok) throw new Error(`cloth poll failed: ${await readError(pollRes)}`);

    const body = await pollRes.json();
    const data = body?.data ?? body;
    const status: string | undefined = data?.task_status ?? data?.status;

    if (status === "success" || status === "succeed" || status === "completed") {
      const url = extractResultUrl(body);
      if (url) return url;
      throw new Error("cloth success but no result URL");
    }
    if (status === "error" || status === "failed") {
      const code = data?.error ?? data?.error_code ?? "unknown_error";
      const msg = data?.error_message ?? "";
      throw new Error(`cloth task failed: ${code} ${msg}`.trim());
    }

    const url = extractResultUrl(body);
    if (url) return url;

    const wait = Number(data?.polling_interval) * 1000 || POLL_INTERVAL_MS;
    // Don't sleep past the deadline — we'd rather exit the loop and return a
    // clean fallback than be terminated mid-sleep.
    if (Date.now() + wait >= deadline) break;
    await sleep(wait);
  }

  throw new Error("cloth try-on timed out while polling");
}

function extractResultUrl(payload: unknown): string {
  const p = payload as {
    data?: { results?: { url?: string }; result?: { url?: string } };
    results?: { url?: string };
  };
  return (
    p?.data?.results?.url ??
    p?.data?.result?.url ??
    p?.results?.url ??
    ""
  );
}
