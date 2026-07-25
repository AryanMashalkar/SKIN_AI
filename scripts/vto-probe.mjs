// Validates the Perfect Corp AI Clothes VTO endpoint using already-public image
// URLs (no tunnel needed). Confirms the request contract + response shape and
// prints the generated result image URL.
//
// Usage: node scripts/vto-probe.mjs

import { readFileSync, existsSync, writeFileSync } from "node:fs";

const BASE = process.env.PERFECTCORP_VTO_BASE_URL ?? "https://yce-api-01.makeupar.com";
const CLOTH = "/s2s/v2.0/task/cloth";

// Public test images (Perfect Corp fetches these directly).
const SRC_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Full-body_photograph_of_Vaishnavi_Chouhan_in_saree%2C_Jaipur_%282025%29.jpg/960px-Full-body_photograph_of_Vaishnavi_Chouhan_in_saree%2C_Jaipur_%282025%29.jpg";
const REF_URL = "https://fakestoreapi.com/img/71li-ujtlUL._AC_UX679_t.png"; // cotton jacket

function loadEnv() {
  for (const n of [".env.local", ".env"]) {
    if (!existsSync(n)) continue;
    for (const l of readFileSync(n, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

loadEnv();
const key = process.env.PERFECTCORP_API_KEY;
if (!key) {
  console.log("✗ PERFECTCORP_API_KEY not set");
  process.exit(1);
}
const auth = { Authorization: `Bearer ${key}` };

console.log("\n▶ Cloth VTO probe");
console.log("  src:", SRC_URL.slice(0, 70) + "…");
console.log("  ref:", REF_URL);
console.log("  garment_category: upper_body\n");

const startRes = await fetch(`${BASE}${CLOTH}`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    src_file_url: SRC_URL,
    ref_file_url: REF_URL,
    garment_category: "upper_body",
    change_shoes: false,
  }),
});
const startText = await startRes.text();
console.log("① POST /task/cloth →", startRes.status);
if (!startRes.ok) {
  console.log("  body:", startText.slice(0, 600));
  process.exit(1);
}
const startJson = JSON.parse(startText);
console.log("  response:", JSON.stringify(startJson).slice(0, 300));
const taskId = startJson?.data?.task_id ?? startJson?.task_id;
if (!taskId) {
  console.log("  ✗ no task_id");
  process.exit(1);
}
console.log("  task_id:", taskId, "\n");

console.log("② polling…");
for (let i = 0; i < 60; i++) {
  const pr = await fetch(`${BASE}${CLOTH}/${encodeURIComponent(taskId)}`, { headers: auth });
  const body = await pr.json();
  const d = body?.data ?? body;
  const st = d?.task_status ?? d?.status;
  console.log(`   poll ${i + 1}: ${st ?? "?"}`);
  if (["success", "succeed", "completed"].includes(st)) {
    writeFileSync("vto-api-raw.json", JSON.stringify(body, null, 2));
    console.log("\n✅ SUCCESS — full response saved to vto-api-raw.json");
    console.log("   result url:", d?.results?.url ?? d?.result?.url ?? "(check json)");
    process.exit(0);
  }
  if (["error", "failed"].includes(st)) {
    console.log("\n✗ FAILED:", JSON.stringify(d).slice(0, 400));
    process.exit(1);
  }
  await sleep(Number(d?.polling_interval) * 1000 || 3000);
}
console.log("timed out");
