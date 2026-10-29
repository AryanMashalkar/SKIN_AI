// Reads an API route's JSON reply without trusting that it *is* JSON.
//
// Errors raised by the platform before a route runs (Vercel's 413 for bodies
// over 4.5 MB, a 504 on timeout) come back as plain text, and `res.json()`
// would throw a SyntaxError that surfaces as a generic "failed". This returns
// the parsed body, or `null` plus a message the shopper can act on.

const PLATFORM_MESSAGES: Record<number, string> = {
  413: "That photo is too large to send — try a smaller one.",
  429: "Too many requests just now — wait a minute and try again.",
  504: "That took too long — please try again.",
};

export async function readJson<T>(res: Response): Promise<{ data: T | null; message: string }> {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      return { data: (await res.json()) as T, message: "" };
    } catch {
      // fall through to the status message
    }
  }
  return {
    data: null,
    message: PLATFORM_MESSAGES[res.status] ?? `Something went wrong (${res.status}). Please try again.`,
  };
}
