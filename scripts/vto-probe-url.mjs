// Cloth VTO probe that takes SRC/REF image URLs from env (VTO_SRC_URL,
// VTO_REF_URL). Used to validate the endpoint with fetchable public URLs.
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const BASE = process.env.PERFECTCORP_VTO_BASE_URL ?? "https://yce-api-01.makeupar.com";
const CLOTH = "/s2s/v2.0/task/cloth";

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
const SRC = process.env.VTO_SRC_URL;
const REF = process.env.VTO_REF_URL;
const CAT = process.env.VTO_CATEGORY || "upper_body";
if (!key || !SRC || !REF) {
  console.log("need PERFECTCORP_API_KEY + VTO_SRC_URL + VTO_REF_URL");
  process.exit(1);
}
const auth = { Authorization: `Bearer ${key}` };
console.log("\n▶ cloth VTO");
console.log("  src:", SRC);
console.log("  ref:", REF);
console.log("  category:", CAT, "\n");

const start = await fetch(`${BASE}${CLOTH}`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ src_file_url: SRC, ref_file_url: REF, garment_category: CAT, change_shoes: false }),
});
const stext = await start.text();
console.log("① POST →", start.status, stext.slice(0, 200));
if (!start.ok) process.exit(1);
const taskId = JSON.parse(stext)?.data?.task_id;
if (!taskId) { console.log("no task_id"); process.exit(1); }

for (let i = 0; i < 60; i++) {
  const body = await (await fetch(`${BASE}${CLOTH}/${encodeURIComponent(taskId)}`, { headers: auth })).json();
  const d = body?.data ?? body;
  console.log(`   poll ${i + 1}: ${d?.task_status}`);
  if (["success", "succeed", "completed"].includes(d?.task_status)) {
    writeFileSync("vto-api-raw.json", JSON.stringify(body, null, 2));
    console.log("\n✅ SUCCESS → result url:", d?.results?.url ?? "(see vto-api-raw.json)");
    process.exit(0);
  }
  if (["error", "failed"].includes(d?.task_status)) {
    console.log("\n✗", JSON.stringify(d).slice(0, 300));
    process.exit(1);
  }
  await sleep(Number(d?.polling_interval) * 1000 || 3000);
}
