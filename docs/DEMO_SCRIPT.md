# Demo video script — MIROIR (target 2:30–2:50)

Devpost requires **1–3 minutes**, publicly visible on YouTube, showing the
project running on its target device and **explaining which YouCam APIs are
used**. Judges are not required to watch past three minutes, so nothing load-
bearing goes after 2:50.

Record on a real phone against the live URL (`skin-ai-lake.vercel.app`) in
**bright, even light** (face a window). Use a real face and a real upper/full-
body photo. Screen-record the phone; voice-over after if needed.

Rule: **show, don't narrate the plumbing.** Every claim on screen should be a
live action, not a slide.

---

## 0:00–0:15 — The hook (problem)

- **On screen:** the home page hero.
- **Say:** "Personal colour analysis genuinely works — but it's a paid, in-person
  appointment that costs more than the clothes it advises on. Most people never
  get it, so they buy colours they like instead of colours that suit them.
  MIROIR does it from one selfie, and proves it on your own body."

> Lead with the problem, not the tech. *Potential Impact* is a judged criterion
> and this is the only place it gets stated out loud.

## 0:15–0:50 — Scan (Skin Analysis API)

- **Do:** tap **Scan my skin** → show the photo-tips card → capture or upload.
- **Do:** on the preview step, **pick your hair and eye colour** from the
  swatches. Let the auto-detect pre-select them if it fires, then correct one on
  camera if it's off.
- **Say:** "Season is judged on skin, hair and eyes together — so it asks for
  all three. It'll guess from the photo, but I stay in control."
- **Do:** the analysis animation → the report.
- **Point at:** the 11 concern gauges, skin type, skin age. "That's the
  **Perfect Corp YouCam Skin Analysis API** — eleven real dermatological scores."

## 0:50–1:15 — Your colours (the engine)

- **Do:** scroll to the colour-season card. Expand **"Why … ? See the math."**
- **Point at:** the season, the **confidence bar**, and the per-axis reasoning.
- **Say:** "From the same photo: CIELAB, ITA angle, then hue, value and chroma —
  and the season is named for whichever dominates. It tells me how confident it
  is and why. Skip the hair and eye swatches and that confidence drops, and it
  says so instead of guessing."

> This beat is the differentiator. Hold on the confidence bar for a full second.

## 1:15–1:35 — Shop your skin

- **Do:** scroll the shop; show the match badges and the explainable reasons.
- **Say:** "The shelf reorders around my worst concerns — every recommendation
  traces back to a score, not a bestseller list."

## 1:35–1:50 — Into the fitting room

- **Do:** tap through to `/fashion`.
- **Point at:** the "Styled for your skin" banner, palette swatches, and the
  collection ordered to the season.
- **Say:** "Same scan, same bag — now driving apparel."

## 1:50–2:30 — THE MONEY SHOT (Apparel VTO)

- **Do:** tap **Prove it on your photo** → add the photo → **Generate the
  proof** → wait for the two-up result.
- **Hold on the side-by-side.** "Same garment, same photo, only the colour
  changes. My palette colour works; the clashing one drains me. That's the
  **YouCam Apparel VTO API** proving the colour science on my own body — not a
  swatch on a card."

## 2:30–2:50 — Close (credibility)

- **Do:** cut to a terminal running `npm test` (**239 assertions, six suites**),
  or the README judge table.
- **Say:** "Both YouCam APIs in one chain: skin to concerns to skincare, and
  skin to colour season to clothes worn on you. The engine is unit-tested, the
  photo is deleted as soon as the render finishes, and it never makes a medical
  claim."

> If you show the README, land on the **"What is validated, and what is not"**
> table. Stating the limits out loud reads as rigour, not weakness — and it is
> the single thing most hackathon submissions do not do.

---

## Shot checklist

- [ ] Bright, even lighting; real face; head-and-shoulders for the scan.
- [ ] A clean upper/full-body photo for VTO (arms slightly out).
- [ ] **Hair and eye swatches actually selected on camera** — that is what takes
      confidence from ~0.48 to ~0.87, and it is visible proof the engine uses
      three inputs, not just skin.
- [ ] Blob store connected on Vercel so VTO is live (not the preview fallback).
- [ ] Dry run first so the proof shot renders well; re-shoot if a result is off.
- [ ] Capture the **colour-season card with its confidence bar** and the
      **side-by-side** clearly — those are the two frames judges remember.
- [ ] Both API names said out loud (Devpost requires the APIs be explained).
- [ ] Total under 3:00. Trim the shop beat first if you run long.

## If VTO is slow or flaky on the day

- Pre-warm: run the proof once before recording so images are cached.
- Both routes are rate limited (12 scans / 20 try-ons per 10 min per IP) — don't
  burn the budget on retakes from the same network right before recording.
- Worst case the proof falls back to recoloured previews, which still shows the
  colour difference — but aim for the live `source: perfectcorp` render.
