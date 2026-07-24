// Server-only Perfect Corp "YouCam" Skin Analysis client (S2S API v2.1).
//
// Verified flow (base host yce-api-01.perfectcorp.com):
//   1. POST /s2s/v2.1/file/skin-analysis  -> { file_id, presigned upload request }
//   2. PUT  <presigned url>               -> upload raw image bytes (no auth header)
//   3. POST /s2s/v2.1/task/skin-analysis  -> { task_id }
//   4. GET  /s2s/v2.1/task/skin-analysis/{task_id}  (poll) -> results
//
// Auth: `Authorization: Bearer <PERFECTCORP_API_KEY>` (key from the
// YouCam API Console: https://yce.makeupar.com/api-console/).

import "server-only";
import { ALL_CONCERNS, CONCERN_TO_DST_ACTION } from "@/lib/skin";

const BASE_URL =
  process.env.PERFECTCORP_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const FILE_ENDPOINT = "/s2s/v2.1/file/skin-analysis";
const TASK_ENDPOINT = "/s2s/v2.1/task/skin-analysis";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 45; // ~90s ceiling

export function hasApiKey(): boolean {
  return Boolean(process.env.PERFECTCORP_API_KEY);
}

function authHeaders(): Record<string, string> {
  const key = process.env.PERFECTCORP_API_KEY;
  if (!key) throw new Error("PERFECTCORP_API_KEY is not set");
  return { Authorization: `Bearer ${key}` };
}

/** The SD-tier dst_actions we request, derived from our concern model.
 *  Note: `skin_age` is NOT a valid dst_action (the API enum only accepts the
 *  concern actions + `skin_type`); skin age is derived in normalizeApiResult. */
export const SKIN_DST_ACTIONS = ALL_CONCERNS.map(
  (c) => CONCERN_TO_DST_ACTION[c],
).concat(["skin_type"]);

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.text();
    return `HTTP ${res.status} ${res.statusText}: ${body.slice(0, 500)}`;
  } catch {
    return `HTTP ${res.status} ${res.statusText}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Runs the full 4-step skin analysis and returns the raw result JSON
 * (to be normalized by `normalizeApiResult`). Throws on any failure so the
 * caller can decide whether to fall back to a mock result.
 */
export async function runSkinAnalysis(
  bytes: Uint8Array,
  fileName: string,
  contentType: string,
): Promise<unknown> {
  // --- Step 1: register the file, get a presigned upload URL -------------
  const fileRes = await fetch(`${BASE_URL}${FILE_ENDPOINT}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [
        {
          content_type: contentType,
          file_name: fileName,
          file_size: bytes.byteLength,
        },
      ],
    }),
  });
  if (!fileRes.ok) throw new Error(`file register failed: ${await readError(fileRes)}`);

  const fileJson = await fileRes.json();
  const fileInfo =
    fileJson?.data?.files?.[0] ?? fileJson?.result?.files?.[0] ?? fileJson?.files?.[0];
  const fileId: string | undefined = fileInfo?.file_id;
  const uploadReq = fileInfo?.requests?.[0];
  if (!fileId || !uploadReq?.url) {
    throw new Error("file register: unexpected response shape");
  }

  // --- Step 2: PUT the binary to the presigned URL (no auth header) ------
  const uploadRes = await fetch(uploadReq.url, {
    method: uploadReq.method ?? "PUT",
    headers: uploadReq.headers ?? { "Content-Type": contentType },
    body: new Blob([bytes as BlobPart], { type: contentType }),
  });
  if (!uploadRes.ok) throw new Error(`upload failed: ${await readError(uploadRes)}`);

  // --- Step 3: create the analysis task ---------------------------------
  const taskRes = await fetch(`${BASE_URL}${TASK_ENDPOINT}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      src_file_id: fileId,
      dst_actions: SKIN_DST_ACTIONS,
      format: "json",
    }),
  });
  if (!taskRes.ok) throw new Error(`task create failed: ${await readError(taskRes)}`);

  const taskJson = await taskRes.json();
  const taskId: string | undefined =
    taskJson?.data?.task_id ?? taskJson?.result?.task_id ?? taskJson?.task_id;
  if (!taskId) throw new Error("task create: missing task_id");

  // --- Step 4: poll for completion --------------------------------------
  for (let i = 0; i < MAX_POLLS; i++) {
    const pollRes = await fetch(`${BASE_URL}${TASK_ENDPOINT}/${taskId}`, {
      headers: authHeaders(),
    });
    if (!pollRes.ok) throw new Error(`poll failed: ${await readError(pollRes)}`);

    const body = await pollRes.json();
    const data = body?.data ?? body;
    const status: string | undefined = data?.task_status ?? data?.status;

    if (status === "success" || status === "succeed" || status === "completed") {
      return data;
    }
    if (status === "error" || status === "failed") {
      const code = data?.error ?? data?.error_code ?? "unknown_error";
      const msg = data?.error_message ?? "";
      throw new Error(`analysis task failed: ${code} ${msg}`.trim());
    }

    const interval = Number(data?.polling_interval) * 1000 || POLL_INTERVAL_MS;
    await sleep(interval);
  }

  throw new Error("analysis timed out while polling");
}
