// ESM resolve hook so test scripts can use the app's "@/..." path alias
// (which is a TypeScript/bundler convention Node doesn't know about), and can
// import server-only modules without Next's bundler present.

import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = path.resolve(import.meta.dirname, "..", "src");

export function resolve(specifier, context, nextResolve) {
  // `server-only` is a build-time guard that throws if a module is pulled into
  // a client bundle. It has no Node resolution, so stub it rather than strip
  // the import: the guard is worth keeping in the shipped code, and a
  // server-only module should still be unit-testable.
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: "data:text/javascript,export{}", shortCircuit: true };
  }
  // Next ships `next/server` without an extension in its exports map, which
  // bare Node ESM will not resolve. Point at the real file so API route
  // handlers can be imported and exercised directly in tests.
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }
  if (specifier.startsWith("@/")) {
    const base = path.join(SRC, specifier.slice(2));
    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
    const hit = candidates.find((c) => existsSync(c));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }
  return nextResolve(specifier, context);
}
