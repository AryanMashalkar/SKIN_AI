// Server-only Perfect Corp "YouCam" AI Facial Color Tones Analyzer client
// (S2S v2.0). Measures skin, eye, eyebrow, lip and hair colour from the scan
// photo, which feeds the season engine instead of the in-browser sample.
//
// Flow (docs.perfectcorp.com/reference/ai_skin_tone_analysis):
//   1. POST /s2s/v2.0/file                       -> { file_id, presigned upload request }
//   2. PUT  <presigned url>                       -> upload raw image bytes (no auth header)
//   3. POST /s2s/v2.0/task/skin-tone-analysis     -> { task_id }
//   4. GET  /s2s/v2.0/task/skin-tone-analysis/{id} (poll) -> results.color
//
// Costs 20 units per successful task; failed tasks cost nothing. Polling is
// mandatory once a task is started (an un-polled task still consumes units).

import "server-only";
import { parseToneResult, type MeasuredColours } from "@/lib/tone-result";

export type { MeasuredColours };

const BASE_URL =
  process.env.PERFECTCORP_TONE_BASE_URL ?? "https://yce-api-01.makeupar.com";
const FILE_ENDPOINT = "/s2s/v2.0/file";
const TASK_ENDPOINT = "/s2s/v2.0/task/skin-tone-analysis";
const POLL_INTERVAL_MS = 1500;
/** Runs alongside Skin Analysis inside the same 60s route; stop before it. */
const POLL_BUDGET_MS = 40_000;

function authHeaders(): Record<string, string> {
  const key = process.env.PERFECTCORP_API_KEY;
  if (!key) throw new Error("PERFECTCORP_API_KEY is not set");
  return { Authorization: `Bearer ${key}` };
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `HTTP ${res.status}: ${body.slice(0, 300)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runToneAnalysis(
  bytes: Uint8Array,
  contentType: string,
): Promise<MeasuredColours> {
  // --- 1. register the file ------------------------------------------------
  const fileRes = await fetch(`${BASE_URL}${FILE_ENDPOINT}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: "scan.jpg", file_size: bytes.byteLength }],
    }),
  });
  if (!fileRes.ok) throw new Error(`tone file register failed: ${await readError(fileRes)}`);
  const fileJson = await fileRes.json();
  const fileInfo = fileJson?.data?.files?.[0] ?? fileJson?.files?.[0];
  const fileId: string | undefined = fileInfo?.file_id;
  const upload = fileInfo?.requests?.[0];
  if (!fileId || !upload?.url) throw new Error("tone file register: unexpected response shape");

  // --- 2. upload the bytes to the presigned URL (no auth header) -------------
  const putRes = await fetch(upload.url, {
    method: upload.method ?? "PUT",
    headers: upload.headers ?? { "Content-Type": contentType },
    body: new Blob([bytes as BlobPart], { type: contentType }),
  });
  if (!putRes.ok) throw new Error(`tone upload failed: ${await readError(putRes)}`);

  // --- 3. start the task -------------------------------------------------------
  // "medium" face-angle strictness: a phone selfie is rarely dead-on, and the
  // stricter default rejects ordinary scans that Skin Analysis accepts.
  const taskRes = await fetch(`${BASE_URL}${TASK_ENDPOINT}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ src_file_id: fileId, face_angle_strictness_level: "medium" }),
  });
  if (!taskRes.ok) throw new Error(`tone task create failed: ${await readError(taskRes)}`);
  const taskJson = await taskRes.json();
  const taskId: string | undefined = taskJson?.data?.task_id ?? taskJson?.task_id;
  if (!taskId) throw new Error("tone task create: missing task_id");

  // --- 4. poll until success or error ------------------------------------------
  const deadline = Date.now() + POLL_BUDGET_MS;
  while (Date.now() < deadline) {
    const pollRes = await fetch(`${BASE_URL}${TASK_ENDPOINT}/${encodeURIComponent(taskId)}`, {
      headers: authHeaders(),
    });
    if (!pollRes.ok) throw new Error(`tone poll failed: ${await readError(pollRes)}`);
    const body = await pollRes.json();
    const data = body?.data ?? body;
    if (data?.task_status === "success") return parseToneResult(data);
    if (data?.task_status === "error") {
      throw new Error(`tone task failed: ${data?.error ?? "unknown"} ${data?.error_message ?? ""}`.trim());
    }
    if (Date.now() + POLL_INTERVAL_MS >= deadline) break;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("tone analysis timed out while polling");
}
