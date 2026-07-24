// Experiment: find a framing Perfect Corp's skin analysis will accept.
// Tries several sharp transforms of one image against the live API and reports
// which pass. On the first success it dumps the numeric score mapping.
//
// Usage: node scripts/exp-face.mjs image2.jpg

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const BASE_URL = process.env.PERFECTCORP_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const FILE_ENDPOINT = "/s2s/v2.1/file/skin-analysis";
const TASK_ENDPOINT = "/s2s/v2.1/task/skin-analysis";
const DST_ACTIONS = [
  "moisture","redness","oiliness","pore","texture","acne","wrinkle",
  "firmness","radiance","dark_circle_v2","age_spot","skin_type",
];

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    if (!existsSync(name)) continue;
    for (const line of readFileSync(name, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build the candidate framings.
async function variants(inputPath) {
  const base = sharp(inputPath).rotate(); // auto-orient
  const meta = await base.metadata();
  const W = meta.width, H = meta.height;
  const out = [];

  // A) baseline: just cap long edge at 2048
  out.push(["baseline_2048", await sharp(inputPath).rotate()
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 }).toBuffer()]);

  // B) pad 30% margin all sides (edge-copy), then cap 2048
  const p30 = Math.round(Math.max(W, H) * 0.3);
  out.push(["pad30_margin", await sharp(inputPath).rotate()
    .extend({ top: p30, bottom: p30, left: p30, right: p30, extendWith: "copy" })
    .resize({ width: 2048, height: 2048, fit: "inside" })
    .jpeg({ quality: 92 }).toBuffer()]);

  // C) pad 60% margin all sides
  const p60 = Math.round(Math.max(W, H) * 0.6);
  out.push(["pad60_margin", await sharp(inputPath).rotate()
    .extend({ top: p60, bottom: p60, left: p60, right: p60, extendWith: "copy" })
    .resize({ width: 2048, height: 2048, fit: "inside" })
    .jpeg({ quality: 92 }).toBuffer()]);

  // D) contain on a 1500x2000 canvas with neutral bg (adds margin, keeps ratio)
  out.push(["contain_margin", await sharp(inputPath).rotate()
    .resize({ width: 1100, height: 1500, fit: "contain", background: { r: 222, g: 206, b: 190 } })
    .extend({ top: 250, bottom: 250, left: 200, right: 200, background: { r: 222, g: 206, b: 190 } })
    .jpeg({ quality: 92 }).toBuffer()]);

  return out;
}

async function runOne(label, buf, apiKey) {
  const auth = { Authorization: `Bearer ${apiKey}` };
  // 1. register
  const fileRes = await fetch(`${BASE_URL}${FILE_ENDPOINT}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ files: [{ content_type: "image/jpeg", file_name: `${label}.jpg`, file_size: buf.byteLength }] }),
  });
  if (!fileRes.ok) return { label, ok: false, why: `register ${fileRes.status}` };
  const fj = await fileRes.json();
  const fi = fj?.data?.files?.[0] ?? fj?.files?.[0];
  const req = fi?.requests?.[0];
  // 2. upload
  const up = await fetch(req.url, { method: req.method ?? "PUT", headers: req.headers, body: buf });
  if (!up.ok) return { label, ok: false, why: `upload ${up.status}` };
  // 3. task
  const tr = await fetch(`${BASE_URL}${TASK_ENDPOINT}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ src_file_id: fi.file_id, dst_actions: DST_ACTIONS, format: "json" }),
  });
  if (!tr.ok) return { label, ok: false, why: `task ${tr.status}: ${(await tr.text()).slice(0,120)}` };
  const tj = await tr.json();
  const taskId = tj?.data?.task_id ?? tj?.task_id;
  // 4. poll
  for (let i = 0; i < 40; i++) {
    const pr = await fetch(`${BASE_URL}${TASK_ENDPOINT}/${taskId}`, { headers: auth });
    const body = await pr.json();
    const d = body?.data ?? body;
    const st = d?.task_status ?? d?.status;
    if (["success","succeed","completed"].includes(st)) return { label, ok: true, data: d };
    if (["error","failed"].includes(st)) return { label, ok: false, why: d?.error ?? "error" };
    await sleep(Number(d?.polling_interval) * 1000 || 2000);
  }
  return { label, ok: false, why: "timeout" };
}

function flatten(obj, prefix = "", out = {}) {
  if (obj === null || typeof obj !== "object") { if (prefix) out[prefix] = obj; return out; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out)); return out; }
  for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

async function main() {
  loadEnv();
  const apiKey = process.env.PERFECTCORP_API_KEY;
  const img = process.argv[2];
  if (!apiKey || !img || !existsSync(img)) {
    console.log("Usage: node scripts/exp-face.mjs <image>  (with PERFECTCORP_API_KEY set)");
    process.exit(1);
  }

  console.log(`\nBuilding framings for ${img}…`);
  const vs = await variants(resolve(img));
  // Save the variants so you can eyeball them.
  for (const [label, buf] of vs) writeFileSync(`variant_${label}.jpg`, buf);
  console.log(`Saved ${vs.length} variant_*.jpg files to inspect.\n`);

  let firstSuccess = null;
  for (const [label, buf] of vs) {
    process.stdout.write(`▶ ${label.padEnd(16)} (${Math.round(buf.byteLength/1024)}KB) … `);
    const r = await runOne(label, buf, apiKey);
    console.log(r.ok ? "✅ SUCCESS" : `✗ ${r.why}`);
    if (r.ok && !firstSuccess) firstSuccess = r;
  }

  if (!firstSuccess) {
    console.log("\nNo variant passed. Inspect the variant_*.jpg files.");
    return;
  }

  console.log(`\n🎉 Accepted framing: ${firstSuccess.label}`);
  writeFileSync("skin-api-raw.json", JSON.stringify(firstSuccess.data, null, 2));
  console.log("💾 Raw result -> skin-api-raw.json\n");

  const flat = flatten(firstSuccess.data);
  console.log("── NUMERIC FIELDS 0–100 ──────────────────────────────");
  for (const [p, v] of Object.entries(flat))
    if (typeof v === "number" && v >= 0 && v <= 100) console.log(`  ${p.padEnd(50)} = ${v}`);
  console.log("\n── ACTION → PATH MAPPING ─────────────────────────────");
  for (const a of DST_ACTIONS) {
    const hits = Object.entries(flat).filter(([p, v]) => typeof v === "number" && p.toLowerCase().includes(a));
    console.log(hits.length ? hits.map(([p, v]) => `  ${a.padEnd(16)} → ${p} = ${v}`).join("\n") : `  ${a.padEnd(16)} → (none)`);
  }
  console.log("\n── STRINGS ───────────────────────────────────────────");
  for (const [p, v] of Object.entries(flat))
    if (typeof v === "string" && v.length < 40) console.log(`  ${p.padEnd(50)} = ${v}`);
}

main().catch((e) => { console.error("crashed:", e.message); process.exit(1); });
