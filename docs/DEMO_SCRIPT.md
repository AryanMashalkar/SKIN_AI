# Demo video script — Derma (target 2:30–3:00)

Record on a real phone against the live URL (`skin-ai-lake.vercel.app`) in
**bright, even light** (face a window). Use a real face and a real
upper/full-body photo. Screen-record the phone; voice-over after if needed.

Rule: **show, don't narrate the plumbing.** Every claim on screen should be a
live action, not a slide.

---

## 0:00–0:15 — The hook (problem)
- **On screen:** the home page hero.
- **Say:** "Online beauty shopping is a guess. You don't know which products fit
  your skin — or which colours fit *you*. Derma turns one selfie into both."

## 0:15–0:50 — Scan (Skin Analysis API)
- **Do:** tap **Scan my skin** → show the photo-tips card → capture/upload → the
  ~10s analysis animation → the report.
- **Point at:** the 11 concern gauges, skin type, skin age. "That's the Perfect
  Corp YouCam Skin Analysis API — 11 real dermatological scores."
- **Then scroll to the colour-season card.** "And from the same photo we measure
  my skin tone — CIELAB, ITA angle — and place me in my colour season:
  *[e.g. True Autumn]*, with the palette that flatters me."

## 0:50–1:15 — Shop your skin
- **Do:** scroll the shop; show the "Top match / % match" badges and the
  explainable reasons ("Targets your redness and hydration").
- **Say:** "The store reorders around my worst concerns — every recommendation
  traces back to a score. Not a generic bestseller list."

## 1:15–1:40 — Into the fitting room
- **Do:** tap **See the fitting room, styled to your skin** → land on `/fashion`.
- **Point at:** the "Styled for your skin" banner + palette swatches, and that
  the collection is **ordered to my season** (flatter badges on cards).
- **Say:** "Same scan now drives apparel. The clothes are sorted to my
  undertone."

## 1:40–2:20 — THE MONEY SHOT (Apparel VTO)
- **Do:** tap **Prove it on your photo** → add the photo → **Generate the proof**
  → wait for the two-up result.
- **Hold on the side-by-side.** "Same garment, same photo — only the colour
  changes. My palette colour on the left works with my skin; the clashing colour
  on the right drains me. That's the Apparel VTO API proving the colour science
  on my own face."

## 2:20–2:45 — Close (credibility)
- **Do:** quickly show adding to bag / cart, then cut to the terminal running
  `npm test` (18 passing) OR the README judge table.
- **Say:** "Both YouCam APIs, one flow. The colour engine is real and
  unit-tested. It's live, it runs with zero keys in demo mode, and it never
  makes a medical claim. That's Derma."

---

## Shot checklist
- [ ] Bright, even lighting; real face; head-and-shoulders for the scan.
- [ ] A clean upper/full-body photo for VTO (arms slightly out).
- [ ] Blob store connected on Vercel so VTO is live (not preview fallback).
- [ ] Do one dry run so the proof shot renders well; re-shoot if a result looks off.
- [ ] Capture the colour-season card and the side-by-side clearly — those are the
      two frames judges remember.
- [ ] End on `npm test` passing or the README judge table for the credibility beat.

## If VTO is slow/flaky on the day
- Pre-warm: run the proof once before recording so images are cached.
- Worst case, the proof falls back to recoloured previews (still shows the colour
  difference) — but aim for the live `source: perfectcorp` render.
