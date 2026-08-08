// Rate-limit tests. Run with: npm test
//
// These guard a control that protects real money: both API routes proxy a paid
// service. A rate limiter that silently lets everything through is worse than
// none, because it produces false confidence.

import { check, clientKey, rateLimitHeaders, RULES, __reset } from "../src/lib/rate-limit.ts";

let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}

const rule = { limit: 3, windowMs: 1000 };

// --- basic budget ----------------------------------------------------------
__reset();
const first = check("k", rule, 0);
assert("first request allowed", first.ok);
assert("first request reports remaining", first.remaining === 2);
assert("allowed requests carry no retryAfter", first.retryAfter === 0);

assert("second allowed", check("k", rule, 10).ok);
assert("third allowed", check("k", rule, 20).ok);

const fourth = check("k", rule, 30);
assert("fourth blocked", !fourth.ok);
assert("blocked request has 0 remaining", fourth.remaining === 0);
assert("blocked request has a retryAfter", fourth.retryAfter > 0);
assert("retryAfter is in seconds, rounded up", fourth.retryAfter === 1);

// Staying blocked must not extend the window (no punitive lockout).
const fifth = check("k", rule, 40);
assert("still blocked inside the window", !fifth.ok);
assert("repeat blocks do not extend the window", fifth.retryAfter <= fourth.retryAfter);

// --- window rollover -------------------------------------------------------
assert("allowed again after the window expires", check("k", rule, 1001).ok);
assert("budget resets fully", check("k", rule, 1002).remaining === 1);

// --- isolation between callers --------------------------------------------
__reset();
check("a", rule, 0);
check("a", rule, 0);
check("a", rule, 0);
assert("caller a is now blocked", !check("a", rule, 0).ok);
assert("caller b is unaffected", check("b", rule, 0).ok);

// --- isolation between routes ---------------------------------------------
__reset();
const ip = "1.2.3.4";
for (let i = 0; i < RULES.skinAnalyze.limit; i++) check(`skin:${ip}`, RULES.skinAnalyze, 0);
assert("skin route exhausted", !check(`skin:${ip}`, RULES.skinAnalyze, 0).ok);
assert("try-on route still open for the same IP", check(`tryon:${ip}`, RULES.tryOn, 0).ok);

// --- configured budgets are sane ------------------------------------------
assert("skin analyze has a finite budget", RULES.skinAnalyze.limit > 0 && RULES.skinAnalyze.limit < 100);
assert("try-on has a finite budget", RULES.tryOn.limit > 0 && RULES.tryOn.limit < 100);
assert("windows are minutes, not milliseconds", RULES.skinAnalyze.windowMs >= 60_000);

// --- client identity -------------------------------------------------------
const withFwd = new Request("https://x.test", {
  headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
});
assert("x-forwarded-for uses the first entry", clientKey(withFwd) === "9.9.9.9");

const withReal = new Request("https://x.test", { headers: { "x-real-ip": "8.8.8.8" } });
assert("falls back to x-real-ip", clientKey(withReal) === "8.8.8.8");

// Critical: unidentifiable callers must NOT share one bucket, or a single
// attacker could exhaust it and lock out every other anonymous user.
const bare1 = new Request("https://x.test", { headers: { "user-agent": "A" } });
const bare2 = new Request("https://x.test", { headers: { "user-agent": "B" } });
assert("unidentified callers do not collapse into one bucket",
  clientKey(bare1) !== clientKey(bare2));

// --- headers ---------------------------------------------------------------
const okHeaders = rateLimitHeaders({ ok: true, remaining: 5, retryAfter: 0, limit: 10 });
assert("allowed responses advertise the limit", okHeaders["RateLimit-Limit"] === "10");
assert("allowed responses advertise remaining", okHeaders["RateLimit-Remaining"] === "5");
assert("allowed responses omit Retry-After", okHeaders["Retry-After"] === undefined);

const blockedHeaders = rateLimitHeaders({ ok: false, remaining: 0, retryAfter: 42, limit: 10 });
assert("blocked responses set Retry-After", blockedHeaders["Retry-After"] === "42");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
