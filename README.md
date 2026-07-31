# MIROIR — one selfie decides your skincare *and* your colours

[![CI](https://github.com/AryanMashalkar/SKIN_AI/actions/workflows/ci.yml/badge.svg)](https://github.com/AryanMashalkar/SKIN_AI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-239%20assertions-3fb950.svg)](scripts)
[![YouCam API Hackathon](https://img.shields.io/badge/YouCam%20API-Skin%20AI%20%2B%20Apparel%20VTO-c9a227.svg)](https://youcam-api.devpost.com/)

Built for the **YouCam API Skin AI & Apparel VTO Hackathon**, in the combined
**Skin AI + Apparel VTO** track — one causal chain, not two features sharing a
navbar.

> **your skin → your concerns → matched skincare**
> **your skin + hair + eyes → your colour season → apparel, worn on your own photo**

---

## The problem

Two questions decide most beauty and apparel purchases, and online shopping
answers neither: *"is this formulated for my skin?"* and *"will this colour
actually suit me?"*

The second one has a real professional answer. **Personal colour analysis** —
placing someone in a seasonal palette by reading their skin, hair and eye
colouring together — is an established practice that stylists sell as a paid,
in-person, appointment-only service. It works, and almost nobody can get it:
it costs more than the garments it advises on, it requires being physically in
the room with an analyst, and it is unavailable in most places entirely.

So shoppers guess. They buy the colour they *like* rather than the colour that
suits them, and the difference shows up as returns.

**MIROIR takes one selfie and answers both questions in about twenty seconds.**
YouCam Skin Analysis scores eleven dermatological concerns and reorders the
skincare shelf around your actual deficits. A colour-science engine measures
your skin in CIELAB, combines it with your hair and eye colour, and places you
in a twelve-season palette — then Apparel VTO renders those colours **on your
own body** so you can see the difference instead of taking our word for it.

---

## Judge quick access

| To see… | Go here |
| --- | --- |
| **Try it, zero setup** | **[skin-ai-lake.vercel.app](https://skin-ai-lake.vercel.app)** — *Scan my skin* → shop → open the fitting room |
| **The money shot** | On `/fashion` after a scan: **"Prove it on your photo"** — the same garment in your colour vs. a clashing colour, both rendered on you |
| **Both APIs, wired** | `src/lib/perfectcorp.ts` (Skin Analysis S2S) · `src/lib/fashion/vto.ts` (Apparel VTO S2S) |
| **The colour engine** | `src/lib/season.ts` — three-axis dominance model over skin + hair + eyes |
| **How honest it is** | [`data/seasons/README.md`](data/seasons/README.md) — what is validated, what is not, and the exact wording we will not use |
| **It runs on your machine** | `npm install && npm run dev` — works with **zero keys**, in labelled demo mode |
| **It verifies itself** | `npm test` — 239 assertions across six suites |

---

## What it does

1. **Scan** (`/`) — a selfie runs through YouCam Skin Analysis: eleven concern
   scores, skin type, skin age, overall health. In-app framing tips and a
   consent note keep the capture clean.
2. **Shop your skin** (`/`) — every product is scored against your concern
   deficits and reordered worst-concern-first. Each card shows the **evidence**:
   your actual scores behind the recommendation.
3. **Follow a routine** (`/` report) — an ordered AM/PM routine (cleanse →
   treat → moisturise → SPF last) with a Starter/Complete toggle for budget and
   a **best-value** pick, so the cheap workhorse surfaces rather than only the
   priciest formula.
4. **Track progress** (`/` report) — each scan becomes a baseline; a later scan
   shows per-concern deltas and whether a rescan is even meaningful yet.
5. **Know your colours** (`/` report) — skin, hair and eye colour are measured
   and placed in a twelve-season palette, with a **stated confidence** and the
   reasoning for every axis.
6. **Wear your colours** (`/fashion`) — the collection reorders to your season,
   you try garments on your own photo via Apparel VTO, and the proof shot puts
   your colour and a clashing colour side by side on your body.

One bag holds both a serum and a shirt, because one scan chose both.

---

## How it uses the YouCam API (both families)

| Step | YouCam API | What we do |
| --- | --- | --- |
| Read concerns | **Skin Analysis** (S2S v2.1) | `file → presigned PUT → task → poll`, parsing the real `results.output[]` — eleven `ui_score`s plus `skin_type`, `all` and `skin_age`. |
| Read colouring | *(our engine)* | Sample skin from the selfie in-browser → CIELAB → ITA°, undertone, chroma; combine with hair and eye colour → twelve-season classification. |
| Try it on | **Apparel VTO** (S2S v2.0) | `POST /task/cloth { src_file_url, ref_file_url, garment_category }` → poll → the garment rendered on the user's photo. |
| Prove it | **Apparel VTO** | Recolour one garment to a flattering and a clashing shade and render **both** on the user — the side-by-side proof. |

Auth is `Authorization: Bearer <PERFECTCORP_API_KEY>`, **server-side only**. Both
clients start with `import "server-only"` and no `NEXT_PUBLIC_*` variable exists
anywhere in the project, so the key cannot reach the browser.

---

## The colour engine

The differentiator is not the API call — it is the science between the two calls
(`src/lib/color.ts` + `src/lib/season.ts`, pure and unit-tested).

**Twelve-season analysis rests on three independent axes**, and a person's
season is named for whichever dominates:

```
hue     warm   <-> cool      (undertone)
value   light  <-> deep      (overall lightness)
chroma  bright <-> soft      (clarity, including contrast BETWEEN features)
```

**Skin alone cannot resolve this.** Hair drives perceived value more than skin
does, and "bright" seasons are defined by contrast *between* features, which is
undefined with only one feature. Two people with identical skin are different
seasons:

```
skin #e8beac + platinum blonde + blue eyes   -> Light Summer   (confidence 0.87)
skin #e8beac + black hair + near-black eyes  -> Bright Winter  (confidence 0.82)
skin #e8beac alone                           -> Light Summer   (confidence 0.48)
```

That third line is the point: with no hair or eye colour the engine still
answers, but reports **low confidence** and says why, rather than presenting a
guess as a measurement.

**Inputs come from the user, optionally assisted by vision.** Hair and eye
colour are picked from swatches during the scan. MediaPipe face landmarking will
*pre-select* those swatches by sampling the iris (between pupil and limbus) and
the hairline — but detection only ever suggests. It is snapped to a known
pigment value in CIELAB, and two guards reject a hair sample that matches the
background or the forehead. A wrong automatic reading degrades to a swatch the
user corrects, never to a wrong answer used silently.

### What is validated, and what is not

This section is deliberately blunt, because the easy version of this claim is
not true.

| | result |
| --- | --- |
| CIELAB conversion, ITA° | verified against published reference values |
| Twelve-season model vs. **reference archetypes** | **70.8% exact**, 91.7% family (24 synthetic cases) |
| Held-out generalisation after parameter fitting | **58.3%** |
| Agreement with **human analysts on real faces** | **not measured — no data yet** |

The archetypes are synthetic hex triplets built from published season
descriptions. They prove the engine reproduces the textbook *definition*, and
they act as a regression gate. They are **not** evidence that it is right about
real people, and a 25-point gap between fitted and held-out scores says the
parameters are partly memorising 24 self-authored cases.

Parameters were fitted by grid search over 11,664 configurations
(`npm run calibrate:season`), not hand-tuned until the demo looked good.

**The measurement pipeline for the real number is built and tested, waiting on
data** (`npm run agreement`): Cohen's and Fleiss' kappa, plus **weighted kappa**
using a season-distance metric, because the twelve seasons are not nominal
categories — confusing True Spring with Light Spring is a near miss, confusing
it with Deep Winter is not, and unweighted kappa scores those identically.

It computes **human-vs-human agreement first**, and reports engine accuracy as a
ratio against it. That ceiling is not optional: if two trained analysts agree
70% of the time, an engine at 70% is performing at human level and chasing 90%
is chasing noise. Collection protocol in [`data/seasons/README.md`](data/seasons/README.md).

---

## Engineering notes

- **Fail-safe everywhere.** No API key → simulated concern scores, clearly
  labelled. VTO unavailable → recoloured garment preview. A live failure never
  breaks the demo.
- **Demo mode never fakes measurements.** Simulated profiles carry **no colour
  tone at all**, so the report cannot render an ITA angle and CIELAB panel from
  invented data. Simulated scores are labelled; measurements are either real or
  absent.
- **Polling is deadline-based.** Both API clients stop before `maxDuration`
  (60s, the Vercel Hobby ceiling), so a slow generation returns a labelled
  fallback instead of an opaque 504.
- **Uploads are capped at 5 MB on both sides.** The client re-encodes at
  stepped-down quality until the payload fits; both routes reject anything
  larger rather than buffering it into serverless memory.
- **Both routes are rate limited** (`src/lib/rate-limit.ts`) because they spend
  real API credits for anyone who can reach them. *Known limitation:* the
  limiter is in-process, so on serverless it is per-instance and resets on cold
  start — a speed bump, not a guarantee. See [`SECURITY.md`](SECURITY.md).
- **Never medical.** Scores drive cosmetic product and styling suggestions only.
  No diagnosis, no treatment advice, no health record.

---

## Quickstart

```bash
npm install
cp .env.example .env.local   # add PERFECTCORP_API_KEY to hit the real APIs
npm run dev                  # http://localhost:3000

npm test                     # 239 assertions, six suites
npm run validate:season      # season engine vs reference archetypes
npm run agreement            # inter-rater kappa + engine accuracy (awaiting data)
npm run calibrate:season     # re-fit engine parameters by grid search
```

Camera and upload work with **zero keys** in labelled demo mode. For live
Apparel VTO locally you need a public tunnel (`PUBLIC_BASE_URL`); on Vercel,
connect a Blob store.

---

## Project structure

```
src/
  app/
    (skincare)/page.tsx           # Scan + shop + colour report
    fashion/page.tsx              # Fitting room, ordered to your season
    api/skin/analyze/route.ts     # Skin Analysis (or demo) + measured tone
    api/tryon/route.ts            # Apparel VTO; hosts then DELETES the photo
  lib/
    perfectcorp.ts                # Skin Analysis S2S client (server-only)
    fashion/vto.ts                # Apparel VTO S2S client (server-only)
    color.ts                      # CIELAB / ITA° primitives + season palettes
    season.ts                     # Three-axis twelve-tone engine
    agreement.ts                  # Cohen's / Fleiss' / weighted kappa
    appearance-options.ts         # Hair + eye swatches
    appearance-sample.ts          # MediaPipe assist (suggests only)
    rate-limit.ts                 # Abuse control for the paid routes
    cart.ts                       # One cart, skincare + apparel
    image.ts                      # Selfie preprocessing + skin sampling
    matching.ts                   # Explainable product ranking
    fashion/styling.ts            # Garment <-> season matching
data/seasons/
  reference-archetypes.json       # 24 synthetic cases (regression gate)
  labelled-photos.json            # expert labels — schema ready, awaiting data
  README.md                       # what is proven, what is not
scripts/*.test.mjs                # six suites, 239 assertions
```

---

## Privacy

- Your scan photo is sent to Perfect Corp for analysis and is **not retained by
  this app** — never written to disk or a database on our side.
- Your try-on photo goes to **temporary Vercel Blob storage** only so the VTO
  service can fetch it over HTTPS, and is **deleted as soon as the render
  resolves** — including on failure and timeout.
- **Neither photo is persisted to `localStorage`.** Only your cart and derived
  scores/palette are kept in the browser; clearing site data removes them.
- Skin, hair and eye colours are sampled **in the browser**; only hex values
  reach the server.
- Scores are **cosmetic guidance, not medical advice**. No health record is
  created or stored.

---

## Credits & data

Skin Analysis and Apparel VTO by **Perfect Corp · YouCam API**. Face landmarking
by **MediaPipe** (Apache-2.0). Skincare product imagery is generated in-app
(owned SVG).

**Demo catalog.** The twelve skincare products and six garments are
demonstration data with placeholder imagery, not real inventory. Any
merchandising badge on them is illustrative. Replacing this with real affiliate
inventory is the next substantial piece of work.

MIT licensed — see [LICENSE](LICENSE).
