# Pre-registration: does MIROIR's colour season hold steady?

These rules were written and committed **before any scan in this study was
run**. The commit history is the timestamp. Results go in a separate file, and
the thresholds below do not change once scanning starts.

## The question

When the same person is photographed more than once, does MIROIR give a stable
colour season, and does it warn people when it should not be trusted?

**This study does not measure accuracy.** It has no trained colour analyst, so
it cannot say whether a season is *correct*, only whether it is *consistent* and
*honest about its uncertainty*. See `data/seasons/README.md` for what an accuracy
study would require. Nothing here may be quoted as validation of the season
engine.

## What was already known

Earlier informal scans of one person, run while building the product, read very
differently across photos (ITA° from about −38 to 54.5) and showed the photo
sample and YouCam's analyzer ΔE 17 apart on one live scan. Those scans shaped
these rules. They are **exploratory, do not count as results**, and will be
reported separately. A study photo may be looked at for capture quality before
scanning, but not scanned.

## Photo conditions

The condition is assigned **before** the photo is scanned, and photos are never
moved between conditions afterwards.

| Condition | Definition |
| --- | --- |
| `daylight` | Facing a window in daytime. No filter, beauty or portrait mode. |
| `indoor` | Even indoor light. No filter, beauty or portrait mode. |
| `lamp` | A warm lamp or evening room light. No filter, beauty or portrait mode. |
| `stress` | Anything that breaks the app's photo tips: visible filter or heavy processing, dark edges, dim light, strong colour tint, or a small face. |

## Method

- **System under test:** the production site, with the deployed commit SHA
  recorded for every run.
- **Procedure:** the normal in-app flow. Upload the photo, accept the pre-selected
  hair and eye colours without changing them, and record what the report shows.
- **Repeats:** every accepted photo is scanned 3 times. The first scan is the one
  used for R2, R3 and R5.
- **Recorded per scan:** participant code, condition, season, confidence, skin
  hex from each reading, ΔE, whether the readings agree, any warning shown,
  whether it was labelled demo data, timestamp, and commit SHA.

## Sample size

- A **pass or fail verdict** needs at least **3 people**, each with one `daylight`
  and one `indoor` photo.
- With fewer than that, the study may only be described as a **pilot**, and no
  rule may be reported as passed. The number of people and photos must appear
  beside every result.

## Rules

ΔE is CIE76, the measure the app uses. ΔE 10 is the app's existing threshold for
two skin readings agreeing (`SKIN_AGREE_DELTA_E`). `seasonDistance` is the
existing function in `src/lib/agreement.ts`. A **hue flip** is a warm/cool change
between seasons.

| Rule | What it tests | Pass condition |
| --- | --- | --- |
| **R1 Repeatability** | Same photo, 3 scans | Same season in all 3, and photo-sample skin within ΔE 1, for **100%** of accepted photos |
| **R2a Good-light season** | Each person's `daylight` vs `indoor` | Same season in **at least 80%** of people |
| **R2b Good-light skin** | Each person's `daylight` vs `indoor` | Photo-sample skin within ΔE 10 in **at least 80%** of people |
| **R2c No hue flip** | Each person's `daylight` vs `indoor` | No hue flip in **100%** of people |
| **R3 Lamp light** | `lamp` vs the same person's `daylight` | `seasonDistance` of 0.33 or less in **at least 80%** of `lamp` photos |
| **R4 Disagreement is flagged** | Every accepted scan | Whenever the two readings imply different seasons, confidence is 50% or lower and the disagreement box shows; whenever they are over ΔE 10 apart, the disagreement box shows. **100%** of scans |
| **R5 Bad light is flagged** | `stress` vs the same person's `daylight` | When the season differs, a low-confidence warning shows in **at least 80%** of those photos |
| **R6 Rejections are labelled** | Every photo YouCam rejects | Shows "Demo data" and the reason, and is never presented as measured. **100%** of rejections |

R3 and R5 are only reported if the person also has a `daylight` photo. A rule
with no eligible photos is reported as **not tested**, not as passed.

## Exclusions

- A photo may be excluded only **before it is scanned**, or if its owner
  withdraws consent. Exclusions are counted and the reason given.
- A photo that breaks the capture rules is relabelled `stress` before scanning,
  not dropped.
- Rejected photos stay in the results and count towards R6. They may not be
  cropped and rescanned as if they were the same photo. A cropped version is a
  new photo, labelled as a crop.
- A scan that fails because of a server or network error (HTTP 5xx or a timeout)
  may be retried twice, and the retries are logged. Any other result stands.
- Unfavourable results are never removed, and photos are not retaken to get a
  better answer. A retake is a new photo and is reported alongside the first.

## Changes to the product

- The first run is the **baseline** and is published whatever it shows.
- If the product changes afterwards, such as a two-photo mode, the same photos are
  rescanned under the same rules and **both** runs are published, each with its
  commit SHA.
- A result from a later run does not replace the baseline. If photos were used to
  design the change, the page must say so, because results on those photos will
  flatter it.

## Amendments

Any change to this file after the first scan is appended below with a date and a
reason, and applies only to scans run after that date.

## Privacy and consent

- Every participant agrees to their selfie being scanned. Photos go to YouCam
  through the normal app flow.
- Photos are not committed to this repository.
- Published results use participant codes (P1, P2) and contain numbers only. A
  face is shown only with that person's explicit permission.

## Limits to state alongside any result

- A small, convenience sample of people known to the author. It does not
  represent all skin tones, and it must not be presented as if it does.
- The author chose the participants and ran the study.
- Phones and lighting are not controlled beyond the definitions above.
- Scores are cosmetic guidance, not medical advice.

## Amendments log

None yet.
