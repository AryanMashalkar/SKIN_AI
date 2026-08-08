# Security Policy

## Reporting a vulnerability

Open a private security advisory on this repository, or contact the maintainer
directly. Please do not open a public issue for anything exploitable.

## Handling of user images

This project processes photographs of people's faces and bodies. That shapes
several deliberate design decisions:

| Concern | Handling |
| --- | --- |
| Scan photo | Sent to Perfect Corp for analysis. Not written to disk or to a database by this app. |
| Try-on photo | Written to temporary Vercel Blob storage **only** so the Apparel VTO service can fetch it over HTTPS, and deleted in a `finally` block as soon as the render resolves — including on failure and timeout. |
| Persistence | Neither photo is persisted to `localStorage`. Only the cart and derived scores/palette are kept in the browser. |
| Colour sampling | Skin, hair and eye colours are sampled **in the browser**; only hex values reach the server. |
| Medical data | None is created or stored. Scores drive cosmetic guidance only, never diagnosis or treatment advice. |

## Abuse controls

Both API routes proxy a paid third-party service and are therefore rate limited
per client (`src/lib/rate-limit.ts`), size-capped at 5 MB per image on both the
client and the server, and restricted to a JPEG/PNG/WebP allowlist.

**Known limitation:** rate limiting is an in-process fixed window. On serverless
it is per-instance and resets on cold start, so it is a speed bump rather than a
guarantee. The durable fix is a shared store (Vercel KV / Upstash Redis); the
swap point is marked in `src/lib/rate-limit.ts`.

## Secrets

`PERFECTCORP_API_KEY` is server-only. Both API clients begin with
`import "server-only"`, and no `NEXT_PUBLIC_*` variable exists anywhere in the
project, so the key cannot reach the browser. `.env*` is gitignored and no
secret has ever been committed.

If you fork or redeploy this project, rotate the key — a key used in a public
demo deployment should be treated as spent.
