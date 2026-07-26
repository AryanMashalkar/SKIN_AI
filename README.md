# Derma — your skin picks your products *and* your colours

**Derma** is a personalized beauty storefront where one selfie drives everything.
A shopper scans their face; the **Perfect Corp YouCam Skin Analysis API** scores
11 dermatological concerns; a local colour-science engine reads their skin tone
into a **personal colour season**; and both stores reorder around them — matched
skincare **and** apparel they can try on their own photo in their most
flattering colours.

Built for the **YouCam API Skin AI & Apparel VTO Hackathon** — using **both**
API families as one causal chain, not two demos in a trench coat.

> **your skin → your concerns → matched skincare**
> **your skin → your undertone → your colour season → apparel, worn on you**

---

## Judge quick access

| To see… | Go here |
| --- | --- |
| **Try it, zero setup** | **[skin-ai-lake.vercel.app](https://skin-ai-lake.vercel.app)** — Scan my skin → shop → open the fitting room |
| **The money shot** | On `/fashion`, after a scan: **"Prove it on your photo"** → the same garment in your colour vs. a clashing colour, rendered on you |
| **Both APIs, wired** | `src/lib/perfectcorp.ts` (Skin Analysis S2S) + `src/lib/fashion/vto.ts` (Apparel VTO S2S) |
| **The science is real** | `npm test` — 18 assertions on the CIELAB / ITA° / season engine (`src/lib/color.ts`) |
| **It runs on your machine** | `npm install && npm run dev` — works with zero keys (labelled demo mode) |

---

## The four flows

1. **Scan** (`/` → *Scan my skin*): a selfie runs through YouCam Skin Analysis →
   11 concern scores, skin type, skin age, overall health. In-app photo tips +
   consent keep the capture clean.
2. **Shop your skin** (`/`): every product is scored against your concern
   deficits and reordered, worst-concern-first. Every match is explainable
   (`src/lib/matching.ts`).
3. **Know your colours** (`/` report): your skin tone is measured and placed in a
   **12-season** personal-colour system with its flattering palette.
4. **Wear your colours** (`/fashion`): the apparel collection is ordered to your
   season, you try garments on **your own photo** via Apparel VTO, and the
   **proof shot** renders one garment in your colour vs. a clashing colour,
   side by side.

## How it uses the YouCam API (both families)

| Step | YouCam API | What we do |
| --- | --- | --- |
| Read concerns | **Skin Analysis** (S2S v2.1) | `file → presigned PUT → task → poll`; parse the real `results.output[]` — 11 `ui_score`s + `skin_type` + `all` + `skin_age`. |
| Read colouring | *(our colour engine)* | Sample the wearer's skin colour from the selfie → CIELAB → **ITA°** (depth), **undertone** (a\*–b\* plane), **12-season**. |
| Try it on | **Apparel VTO** (S2S v2.0) | `POST /task/cloth { src_file_url, ref_file_url, garment_category }` → poll → rendered result on the user's photo. |
| Prove it | **Apparel VTO** | Recolour one garment to a flattering vs. clashing shade and render **both** on the user — the side-by-side money shot. |

Auth is `Authorization: Bearer <PERFECTCORP_API_KEY>`, **server-side only** — the
key never reaches the browser.

## The colour engine (our IP)

The differentiator isn't the API call — it's the science in between
(`src/lib/color.ts`, pure and unit-tested):

- **CIELAB** conversion (D65) verified against known reference values.
- **ITA°** (Individual Typology Angle) — the dermatology-standard skin-depth
  metric — for depth (light / medium / deep).
- **Undertone** from the a\*–b\* plane (golden-yellow vs pink-blue), robust across
  skin depths.
- A rule-based map onto the **12 seasons**, each with a wearable palette.

Skin colour is sampled **in the browser** from the face region of the scan photo
(`src/lib/image.ts`) and passed to the server as a hex — so there's no native
image decoding on the serverless runtime. Run `npm test` to see the engine
validated (18 assertions).

## Engineering notes judges tend to ask about

- **Both images for VTO are hosted for you.** Apparel VTO fetches images from
  public URLs, so the uploaded photo (and recoloured garments) are pushed to
  **Vercel Blob** in production, or served over a dev tunnel locally. The route
  pre-flights both URLs and reports exactly which one is unreachable.
- **Fail-safe everywhere.** No API key → simulated concern scores (real measured
  tone). VTO unavailable → recoloured garment preview. A live failure never
  breaks the demo; the UI labels demo data.
- **Never medical.** Skin scores drive *cosmetic* product and *styling*
  suggestions only — explicitly not medical or treatment advice.

## Quickstart

```bash
npm install
cp .env.example .env.local   # add PERFECTCORP_API_KEY to hit the real APIs
npm run dev                  # http://localhost:3000
npm test                     # colour-engine assertions
```

Camera/upload work with zero keys (demo mode). For live Apparel VTO locally you
need a public tunnel (`PUBLIC_BASE_URL`); on Vercel, connect a **Blob** store.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Zustand
(persisted) · Vercel Blob · deployed on Vercel. Perfect Corp YouCam **Skin
Analysis** (S2S v2.1) + **Apparel VTO** (S2S v2.0).

## Project structure

```
src/
  app/
    (skincare)/page.tsx           # Skin scan + shop + colour report
    fashion/page.tsx              # Apparel VTO fitting room, ordered to your season
    api/skin/analyze/route.ts     # Skin Analysis (or mock) + attach measured tone
    api/tryon/route.ts            # Apparel VTO; hosts photo + recoloured garments
  lib/
    perfectcorp.ts                # ★ Skin Analysis S2S client (server-only)
    fashion/vto.ts                # ★ Apparel VTO S2S client (server-only)
    color.ts                      # ★ CIELAB / ITA° / 12-season engine (tested)
    image.ts                      # Selfie preprocessing + browser skin sampling
    matching.ts                   # Explainable product ranking
    fashion/styling.ts            # Garment ↔ season matching
    fashion/recolor.ts            # Browser luminance-preserving garment recolour
  components/                     # Scan, report, fitting room, colour-proof modal, …
scripts/color.test.mjs            # Colour-engine test suite (npm test)
```

## Credits & data

Apparel VTO and Skin Analysis by **Perfect Corp · YouCam API**. Demo garment
catalog images are placeholders for demonstration. Skincare product imagery is
generated in-app (owned SVG). A skin scan is processed by Perfect Corp's API and
is not stored by this app.
