// Search the raw docs payload (incl. JSON hydration) for the face error + reqs.
const PAGES = [
  "https://docs.perfectcorp.com/develop/error_codes",
  "https://docs.perfectcorp.com/reference/ai_skin_analysis",
  "https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.1",
];
const NEEDLES = [
  "error_src_face_too_small",
  "face_too_small",
  "too small",
  "face area",
  "face region",
  "face width",
  "resolution",
  "recommend",
  "megapixel",
];

function unescapeJson(s) {
  return s
    .replace(/\\u002F/gi, "/")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, " ");
}

for (const url of PAGES) {
  const raw = await fetch(url).then((r) => r.text());
  console.log(`\n===== ${url} =====`);
  for (const needle of NEEDLES) {
    let idx = raw.indexOf(needle);
    let count = 0;
    while (idx !== -1 && count < 2) {
      const ctx = unescapeJson(raw.slice(Math.max(0, idx - 160), idx + 220));
      console.log(`\n[${needle}] …${ctx}…`);
      idx = raw.indexOf(needle, idx + needle.length);
      count++;
    }
  }
}
