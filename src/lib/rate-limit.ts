import "server-only";

// Abuse protection for the paid-API proxy routes.
//
// Both /api/skin/analyze and /api/tryon spend real Perfect Corp credits on
// behalf of anyone who can reach them. On a public URL that is a billing
// denial-of-service waiting to happen, and the Vercel Blob writes in the
// try-on path are an unauthenticated file-upload surface on top.
//
// HONEST LIMITATION: this is an in-process sliding window. On serverless it is
// per-instance and resets on cold start, so a determined attacker spraying
// across instances gets more than `limit` requests. It is a speed bump, not a
// guarantee. The durable fix is a shared store (Vercel KV / Upstash Redis) -
// see `RATE_LIMIT_BACKEND` below for the swap point. It is still worth having:
// it stops casual scraping and runaway client retry loops, which are the
// realistic failure modes for a demo.

export interface RateLimitResult {
  ok: boolean;
  /** Requests still allowed in the current window. */
  remaining: number;
  /** Seconds until the window frees up. Only meaningful when !ok. */
  retryAfter: number;
  limit: number;
}

export interface RateLimitRule {
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Per-route budgets. Deliberately tight: a real person scanning their face does
 * it a handful of times, not fifty. Try-on is stricter because each call costs
 * a generation credit AND writes to blob storage.
 */
export const RULES = {
  skinAnalyze: { limit: 12, windowMs: 10 * 60_000 },
  tryOn: { limit: 20, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/** Swap point for a shared backend. In-memory is the default. */
export const RATE_LIMIT_BACKEND = "memory" as const;

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

/**
 * Drops expired buckets so a long-lived instance does not grow unbounded under
 * a spray of unique IPs. Cheap: only runs when the map gets large.
 */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Fixed-window counter, keyed by route + client.
 *
 * Exported with an injectable clock so the behaviour is unit-testable without
 * sleeping in tests.
 */
export function check(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1, retryAfter: 0, limit: rule.limit };
  }

  if (existing.count >= rule.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      limit: rule.limit,
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: rule.limit - existing.count,
    retryAfter: 0,
    limit: rule.limit,
  };
}

/** Test seam. */
export function __reset(): void {
  buckets.clear();
}

/**
 * Best-effort client identity.
 *
 * `x-forwarded-for` is client-controllable in general, but on Vercel the edge
 * rewrites it, so the FIRST entry is the real client. We deliberately do not
 * fall back to a constant when headers are absent: that would put every
 * anonymous caller in one bucket and let a single attacker lock out all users.
 * An unidentifiable caller gets its own bucket instead.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return `anon:${req.headers.get("user-agent") ?? "unknown"}`;
}

/** Standard headers so clients can back off intelligently. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
  };
  if (!r.ok) h["Retry-After"] = String(r.retryAfter);
  return h;
}
