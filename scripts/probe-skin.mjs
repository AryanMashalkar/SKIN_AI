// Standalone probe for the Perfect Corp YouCam Skin Analysis API (S2S v2.1).
//
// Runs the REAL 4-step flow against a selfie and dumps the raw response so we
// can confirm the exact JSON key names and lock `src/lib/skin.ts` normalizer.
//
// Usage:
//   node scripts/probe-skin.mjs path/to/selfie.jpg
//
// Requires PERFECTCORP_API_KEY (read from .env.local / .env / process env).
// Node 18+ (global fetch). This project targets Node 20+.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

// ---- config -------------------------------------------------------------
const BASE_URL =
  process.env.PERFECTCORP_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const FILE_ENDPOINT = "/s2s/v2.1/file/skin-analysis";
const TASK_ENDPOINT = "/s2s/v2.1/task/skin-analysis";

// Same SD-tier actions the app requests (see src/lib/skin.ts).
const DST_ACTIONS = [
  "moisture",
  "redness",
  "oiliness",
  "pore",
  "texture",
  "acne",
  "wrinkle",
  "firmness",
  "radiance",
  "dark_circle_v2",
  "age_spot",
  "skin_type",
];

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

// ---- tiny .env loader (no dependency) -----------------------------------
function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    if (!existsSync(name)) continue;
    const text = readFileSync(name, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (val && !process.env[key]) process.env[key] = val;
    }
  }
}

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  loadEnv();

  const apiKey = process.env.PERFECTCORP_API_KEY;
  const imgPath = process.argv[2];

  if (!apiKey) {
    log("✗ PERFECTCORP_API_KEY not set. Add it to .env.local first.");
    process.exit(1);
  }
  if (!imgPath || !existsSync(imgPath)) {
    log("✗ Provide a path to a selfie: node scripts/probe-skin.mjs selfie.jpg");
    process.exit(1);
  }

  const bytes = readFileSync(resolve(imgPath));
  const ext = extname(imgPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "image/jpeg";
  const fileName = basename(imgPath);
  const auth = { Authorization: `Bearer ${apiKey}` };

  log(`\n▶ Image: ${fileName} (${bytes.byteLength} bytes, ${contentType})`);
  log(`▶ Host:  ${BASE_URL}\n`);

  // --- Step 1: register file --------------------------------------------
  log("① POST /file/skin-analysis  (register + presigned URL)");
  const fileRes = await fetch(`${BASE_URL}${FILE_ENDPOINT}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [
        { content_type: contentType, file_name: fileName, file_size: bytes.byteLength },
      ],
    }),
  });
  await guard(fileRes, "file register");
  const fileJson = await fileRes.json();
  const fileInfo =
    fileJson?.data?.files?.[0] ?? fileJson?.result?.files?.[0] ?? fileJson?.files?.[0];
  const fileId = fileInfo?.file_id;
  const uploadReq = fileInfo?.requests?.[0];
  if (!fileId || !uploadReq?.url) {
    log("  ✗ Unexpected shape — full response:");
    log(JSON.stringify(fileJson, null, 2));
    process.exit(1);
  }
  log(`  ✓ file_id: ${fileId}`);

  // --- Step 2: upload ----------------------------------------------------
  log("② PUT  <presigned url>  (binary upload)");
  const uploadRes = await fetch(uploadReq.url, {
    method: uploadReq.method ?? "PUT",
    headers: uploadReq.headers ?? { "Content-Type": contentType },
    body: bytes,
  });
  await guard(uploadRes, "upload");
  log("  ✓ uploaded");

  // --- Step 3: create task ----------------------------------------------
  log("③ POST /task/skin-analysis  (start analysis)");
  const taskRes = await fetch(`${BASE_URL}${TASK_ENDPOINT}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      src_file_id: fileId,
      dst_actions: DST_ACTIONS,
      format: "json",
    }),
  });
  await guard(taskRes, "task create");
  const taskJson = await taskRes.json();
  const taskId =
    taskJson?.data?.task_id ?? taskJson?.result?.task_id ?? taskJson?.task_id;
  if (!taskId) {
    log("  ✗ No task_id — full response:");
    log(JSON.stringify(taskJson, null, 2));
    process.exit(1);
  }
  log(`  ✓ task_id: ${taskId}`);

  // --- Step 4: poll ------------------------------------------------------
  log("④ GET  /task/skin-analysis/{id}  (polling)");
  let result = null;
  for (let i = 0; i < 45; i++) {
    const pollRes = await fetch(`${BASE_URL}${TASK_ENDPOINT}/${taskId}`, {
      headers: auth,
    });
    await guard(pollRes, "poll");
    const body = await pollRes.json();
    const data = body?.data ?? body;
    const status = data?.task_status ?? data?.status;
    process.stdout.write(`  · poll ${i + 1}: ${status ?? "?"}\n`);
    if (["success", "succeed", "completed"].includes(status)) {
      result = data;
      break;
    }
    if (["error", "failed"].includes(status)) {
      log("  ✗ Task failed — full response:");
      log(JSON.stringify(data, null, 2));
      process.exit(1);
    }
    await sleep(Number(data?.polling_interval) * 1000 || 2000);
  }
  if (!result) {
    log("  ✗ Timed out.");
    process.exit(1);
  }
  log("  ✓ success\n");

  // --- Dump + analyze ----------------------------------------------------
  const outFile = "skin-api-raw.json";
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  log(`💾 Raw result written to ${outFile}\n`);

  const flat = flatten(result);
  const numeric = Object.entries(flat).filter(([, v]) => typeof v === "number");
  const scoreCandidates = numeric.filter(([, v]) => v >= 0 && v <= 100);

  log("── NUMERIC FIELDS 0–100 (likely concern scores) ──────────────");
  for (const [path, v] of scoreCandidates.sort((a, b) => a[0].localeCompare(b[0]))) {
    log(`  ${path.padEnd(48)} = ${v}`);
  }

  log("\n── SUGGESTED ACTION → PATH MAPPING ───────────────────────────");
  for (const action of DST_ACTIONS) {
    const hits = numeric.filter(([p]) => p.toLowerCase().includes(action));
    if (hits.length) {
      for (const [p, v] of hits) log(`  ${action.padEnd(16)} → ${p} = ${v}`);
    } else {
      log(`  ${action.padEnd(16)} → (no matching numeric key found)`);
    }
  }

  log("\n── STRING FIELDS (skin_type, etc.) ───────────────────────────");
  for (const [path, v] of Object.entries(flat)) {
    if (typeof v === "string" && v.length < 40) log(`  ${path.padEnd(48)} = ${v}`);
  }

  log(
    "\n✅ Compare the mapping above with CONCERN_TO_DST_ACTION and pickScore()" +
      "\n   in src/lib/skin.ts. If key names differ, that's the only edit needed.",
  );
}

async function guard(res, label) {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  console.log(`  ✗ ${label} failed: HTTP ${res.status} ${res.statusText}`);
  if (res.status === 401 || res.status === 403) {
    console.log(
      "  ⚠ Auth rejected. If a bare Bearer key doesn't work, this key may need" +
        "\n    the RSA id_token handshake (POST /s2s/v1.0/client/auth). Check the" +
        "\n    API Console docs and tell me — I'll swap authHeaders() accordingly.",
    );
  }
  console.log(`  body: ${body.slice(0, 800)}`);
  process.exit(1);
}

function flatten(obj, prefix = "", out = {}) {
  if (obj === null || typeof obj !== "object") {
    if (prefix) out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

main().catch((e) => {
  console.error("\n✗ Probe crashed:", e.message);
  process.exit(1);
});
