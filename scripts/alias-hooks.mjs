// ESM resolve hook so test scripts can use the app's "@/..." path alias
// (which is a TypeScript/bundler convention Node doesn't know about).

import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = path.resolve(import.meta.dirname, "..", "src");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(SRC, specifier.slice(2));
    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
    const hit = candidates.find((c) => existsSync(c));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }
  return nextResolve(specifier, context);
}
