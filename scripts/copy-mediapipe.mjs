// Copies the MediaPipe vision WASM runtime out of node_modules into public/
// so the browser can load it from our own origin.
//
// Why this is a build step and not committed:
//   - the WASM binaries are ~11 MB each and are fully reproducible from the
//     pinned @mediapipe/tasks-vision version, so committing them would add
//     >20 MB to every clone for no benefit;
//   - the face_landmarker.task model IS committed, because it is fetched from
//     Google's model store rather than npm and cannot be regenerated locally.
//
// Serving from our own origin (rather than a CDN) means a demo cannot break
// because a third-party host is slow or blocked.

import { mkdir, copyFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// `new URL("../")` already resolves to the repo root and ends in a separator;
// passing that through path.dirname() would strip a further level.
const root = fileURLToPath(new URL("../", import.meta.url));
const src = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = path.join(root, "public", "mediapipe", "wasm");

// SIMD build plus the no-SIMD fallback. The "module" variant targets a loading
// mode we do not use, and is skipped to save ~11 MB of deploy payload.
const FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

try {
  await access(src);
} catch {
  console.warn("[mediapipe] @mediapipe/tasks-vision not installed - skipping.");
  console.warn("[mediapipe] Hair/eye auto-detection will fall back to manual pickers.");
  process.exit(0);
}

await mkdir(dest, { recursive: true });
let copied = 0;
for (const f of FILES) {
  try {
    await copyFile(path.join(src, f), path.join(dest, f));
    copied++;
  } catch (err) {
    console.warn(`[mediapipe] could not copy ${f}: ${err.message}`);
  }
}
console.log(`[mediapipe] copied ${copied}/${FILES.length} runtime files to public/mediapipe/wasm`);
