# Demo video script — MIROIR (target 2:40, hard cap 2:55)

Devpost requires **1–3 minutes**, publicly visible on YouTube, showing the
project running on its target device and **explaining which YouCam APIs are
used**. Judges are not required to watch past three minutes, and many decide
in the first twenty seconds — so the story and the proof shot come first, and
the tour comes after.

Colour names and numbers below come from a Deep Autumn test scan. **Read
yours off the screen** — your own scan may pick a different garment and
colours, and the script should say what the app actually shows.

**One sentence to land:** *"The photo sells you a colour. MIROIR measures which
colour of that same item suits you — and shows it on you before you buy."*

---

## Before you record

- [ ] **Live URL, not localhost.** Record `skin-ai-lake.vercel.app` after the
      new branch is deployed. No `localhost` in any address bar.
- [ ] **Phone screen recording**, or a full-screen browser with the taskbar
      hidden. Nothing from the desktop in frame.
- [ ] **Your own face and body**, in bright, even daylight (face a window).
      "On *my* body" only works if it is you.
- [ ] `PERFECTCORP_API_KEY` set and a Blob store connected, so both try-ons
      come back `source: perfectcorp` — not the recoloured preview.
- [ ] AI stylist: with `ANTHROPIC_API_KEY` set, the card says **"Planned by
      Claude with measured tools"**. Without it, it says **"Planned by rules"**
      — then use the "rules" line in beat 4 and do not claim AI.
- [ ] **Dry run** the proof shot and the stylist once. Results are cached per
      colour, so the take is fast.
- [ ] **Burn in captions** (CapCut / YouTube Studio). Auto-captions previously
      heard "YouCam" as "UKAM"; judges may be watching with captions on.
- [ ] Speak slower than feels natural. Say **"YouCam Skin Analysis"** and
      **"YouCam Apparel VTO"** clearly, once each, while they are on screen.

---

## 0:00–0:20 — The problem, shown (the proof shot)

- **On screen:** open straight on the result of **"Prove it on your photo"**:
  the same jacket on you twice — *as pictured* vs. *our pick*.
- **Say:** "This jacket sells in deep purple — that's the photo. On me, it's
  this. Same jacket, same photo of me, only the colour changes. The left one
  is what MIROIR measured for my skin."
- Hold the side-by-side for a full two seconds. **This is the frame judges
  remember.**

## 0:20–0:30 — Who it's for

- **On screen:** the fitting room, colour swatches visible.
- **Say:** "Most clothes online come in five colours. People pick from the
  photo, and the wrong colour is a return. MIROIR picks the colour from your
  face."

## 0:30–1:05 — The scan (YouCam Skin Analysis)

- **Do:** *Scan my skin* → photo tips → capture → pick hair and eye swatches.
- **Point at:** the concern gauges, then the colour season with its
  **confidence bar**.
- **Say:** "One selfie. **YouCam Skin Analysis** scores eleven skin concerns —
  including redness, which matters in a minute. From the same photo, MIROIR
  measures skin, hair and eye colour and places me in a season — Deep Autumn,
  with how confident it is."

## 1:05–1:40 — The right colourway (the engine + YouCam Apparel VTO)

- **Do:** back to the fitting room. Point at a card's swatches: the green dots
  and the amber one.
- **Say** (on the snowboard jacket): "Every garment's colours are ranked for
  me, with the number behind it — deep teal is closest to my palette, delta-E
  four. Purple, the one in the photo, clashes."
- **Do:** tap **Try on** → the chosen colourway → **Try it on**.
- **Say:** "And **YouCam Apparel VTO** puts the colour I'd actually buy on my
  own photo."

## 1:40–2:20 — The occasion stylist (the agent)

- **Do:** type or tap **"Smart-casual brunch on Sunday, under $130"** →
  **Style me**. Open **"How it decided"**.
- **Say (Claude on):** "Now I just say where I'm going. The stylist reads my
  scan, searches the collection, ranks every colour and builds a look under
  budget. It's an agent — but it can't invent a measurement: every score here
  comes from the tools, and if it picks a clashing colour or goes over budget,
  the store rejects it and it has to fix it."
- **Say (rules mode instead):** "Without an AI key, a rules planner runs the
  same measured tools — and the card says so."
- **Do:** tap **See it on you** on one piece → it opens in that colour.

## 2:20–2:40 — Close

- **On screen:** the README's **"Updated during the submission period"** table,
  or the look card with the bag.
- **Say:** "Skin Analysis picks the colour, Apparel VTO proves it on you, and
  the stylist plans the whole look — every number measured, three hundred and
  forty-nine tests, and your photo is deleted the moment the render finishes.
  That's MIROIR."

---

## What to cut if you run long

In this order: the skincare shelf (never shown in this cut), the swatch
walkthrough in beat 4 (keep the try-on), then the "How it decided" panel. Never
cut the opening proof shot or the two spoken API names.

## Things not to say

- Don't call scores "medical" or "diagnosis" — cosmetic guidance only.
- Don't say the season engine is validated on real faces; it isn't yet
  (see `data/seasons/README.md`).
- Don't claim AI planned a look when the card says "Planned by rules".
- Don't promise fewer returns as a measured result — say *why* the wrong
  colour leads to returns, not a percentage you haven't measured.
