# Derma — AI Skincare, matched to your skin

**Derma** is a consumer-ready skincare storefront where the shopping experience
is driven by clinical AI skin analysis. A shopper scans their face, the
[Perfect Corp **YouCam Skin Analysis API**](https://yce.perfectcorp.com/ai-api/products/skin-analysis-api)
scores 11 dermatological concerns, and the entire catalog reorders and scores
itself against their real skin — then they add their matched routine to the bag
and check out.

Built for the **YouCam API Skin AI & Apparel VTO Hackathon**.

---

## Why this is different

Most skin-analysis demos stop at a report screen. Derma treats the API as what
Perfect Corp actually sells it as — **a retail conversion engine**:

- **Scan → Score → Shop.** Analysis isn't a gimmick bolted onto the side; it is
  the thing that ranks the store.
- **Every recommendation is explainable.** Each product's match score traces
  directly back to your concern deficits (see `src/lib/matching.ts`).
- **It looks like a store a Perfect Corp client would actually ship** — cart,
  mock checkout, filters, the works.

## How the Perfect Corp integration works

The full server-side flow lives in `src/lib/perfectcorp.ts` (S2S API v2.1):

| Step | Endpoint | Purpose |
| ---- | -------- | ------- |
| 1 | `POST /s2s/v2.1/file/skin-analysis` | Register the image, get a presigned upload URL + `file_id` |
| 2 | `PUT <presigned url>` | Upload the raw JPEG bytes (no auth header) |
| 3 | `POST /s2s/v2.1/task/skin-analysis` | Start analysis for the SD-tier `dst_actions` |
| 4 | `GET /s2s/v2.1/task/skin-analysis/{task_id}` | Poll until `success`, read scores |

Auth is `Authorization: Bearer <PERFECTCORP_API_KEY>`.

Selfies are **preprocessed in the browser** (`src/lib/image.ts`) — center-cropped
to a 3:4 portrait and re-encoded — to avoid the API's `error_src_face_too_small`
and oversize rejections.

> **Graceful fallback:** if `PERFECTCORP_API_KEY` is unset (or a live call
> fails mid-demo), the API route returns a realistic **simulated** profile so the
> storefront is always presentable. The UI clearly labels demo data.

## Getting started

```bash
npm install
cp .env.example .env.local   # add PERFECTCORP_API_KEY to hit the real API
npm run dev
```

Open http://localhost:3000 and click **Scan my skin**.

## Tech

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Zustand** for cart + skin-profile state (persisted to localStorage)
- Perfect Corp YouCam Skin Analysis API (S2S v2.1)

## Project structure

```
src/
  app/
    page.tsx                    # Storefront home (hero, how-it-works, shop)
    layout.tsx                  # Navbar + Cart + Scan modal shell
    api/skin/analyze/route.ts   # Server route: runs analysis or mock fallback
  lib/
    perfectcorp.ts              # ★ Perfect Corp S2S API client (server-only)
    skin.ts                     # Concern model, severity, response normalizer
    mock.ts                     # Simulated profile for keyless demos
    products.ts                 # Catalog + concern tagging
    matching.ts                 # Explainable product-ranking engine
    image.ts                    # Client-side selfie preprocessing
    store.ts                    # Zustand cart + profile store
  components/                   # Navbar, Hero, Shop, ScanModal, SkinReport, …
```
