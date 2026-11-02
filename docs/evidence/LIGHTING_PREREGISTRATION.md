# Pre-registration: does the lighting correction hold up?

Written and committed **before this test was run**. The commit history is the
timestamp. Results go in a separate file, and these thresholds do not change once
it has run. Fixing a bug in the test harness is allowed, and any fix is reported.

## The question

MIROIR corrects a photo's lighting before measuring skin colour
(`src/lib/white-balance.ts`). If a photo's light changes by a known amount, how
much does the measured skin colour and the colour season move?

**This does not measure accuracy.** The reference for each photo is MIROIR's own
reading of that photo with no added cast, not a colorimeter or a trained analyst.
It tests stability under simulated light. It cannot show that a season is correct.

## Method

- **Photos:** the 7 selfies of the project's author already held for this project.
  They were taken in ordinary light, some of it poor. Photos are not committed.
- **Framing:** each photo is reframed around the face with the app's rule
  (`faceFocus`). In this test the face box comes from OpenCV's Haar detector, not
  the app's MediaPipe model, because the harness runs outside a browser.
- **Conditions, 7 in all**, as per-channel multipliers (R, G, B):
  warm lamp (1.25, 1.0, 0.7), cool LED (0.85, 1.0, 1.2), green fluorescent
  (0.9, 1.1, 0.85), magenta tint (1.1, 0.88, 1.05), dim (0.6, 0.6, 0.6),
  very dim (0.4, 0.4, 0.4), bright (1.3, 1.3, 1.3).
- **Pipeline:** the shipped `normalizeIllumination`, skin sampler and
  `analyzeAppearance`. Hair and eye colour are held fixed at the app's darkest
  hair and eye options, so only the skin reading can move the season.
- **Measures:** CIE76 ΔE from that photo's no-cast reading, with and without
  correction; season; `seasonDistance`; and whether the app's own low-confidence
  condition fires (`skinConfident` is false).

## Rules

| Rule | Pass condition |
| --- | --- |
| **L1 Correction helps** | Median ΔE with correction is lower than without it |
| **L2 Colour stays close** | Median ΔE with correction is 10 or lower (the app's agreement threshold) |
| **L3 Season holds** | Same season as the reference in at least 80% of cases |
| **L4 No large jumps** | `seasonDistance` of 0.33 or less in at least 90% of cases |
| **L5 Changes are flagged** | When the season changes, the low-confidence condition fires in at least 80% of those cases |

Every photo and condition is reported. A photo where no skin can be sampled counts
as a failure of L3 and L4, not an exclusion.

## Limits to state alongside any result

- One person, photographed by the project's author, and a single skin tone.
- Simulated casts are simple channel multipliers. Real light also changes shadows
  and highlights, so real photos may do worse.
- The author already knows the app can vary between photos (see `PREREGISTRATION.md`).

## Pilot labels for `PREREGISTRATION.md`

Recorded here before any of these photos is scanned. There is one participant, so
under those rules this is a **pilot** and no rule can be reported as passed:

| Photo | Condition | Why |
| --- | --- | --- |
| `12.15.41` | `indoor` | Even indoor light |
| `12.15.42` | `stress` | Dim, dark edges, small face |
| `12.16.33` | `stress` | Looks filtered or heavily processed |
| `15.52.42` (window behind) | `stress` | Backlit, so not "facing a window" |
| `15.52.42 (1)` (from below) | `stress` | Low angle, not straight at the camera; no lamp visible |

With no `daylight` or `lamp` photo, R2, R3 and R5 are **not tested**. The earlier
close-up and portrait were already scanned, so they stay exploratory and are left out.
