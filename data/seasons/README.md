# Season validation data

## Status

| set | cases | what it proves |
| --- | --- | --- |
| `reference-archetypes.json` | 24 | Engine reproduces the **textbook definition** of each season. Regression gate only. |
| `labelled-photos.json` | **0 — not yet collected** | Engine agrees with **trained human analysts on real faces**. This is the number that matters. |

**Nothing in this directory is empirical validation yet.** The archetypes are
synthetic hex triplets authored alongside the engine. Quoting them as evidence
that the engine "works" would be the same error as presenting `mock.ts` output
as a measurement.

## Why the archetypes are not enough

`scripts/calibrate-season.mjs` grid-searched 11,664 parameter configurations
against the archetypes, fitting on one archetype per season and holding out the
other:

```
fit set   (12): 83.3%
HELD OUT  (12): 58.3%   <- 25-point generalisation gap
full set  (24): 70.8%
```

A 25-point gap on 24 self-authored cases means the fitted parameters are
partly memorising the dataset rather than capturing the underlying system. Any
of three things could be true, and the archetypes cannot distinguish them:

1. the three-axis dominance model is underpowered for real faces;
2. the archetype pairs are mutually inconsistent (dataset noise, my error);
3. 24 cases is far too few to fit 8 free parameters.

Only real labelled photographs can tell these apart.

## Collection protocol for `labelled-photos.json`

Target **150–200 subjects**, deliberately balanced across the Fitzpatrick
range — an unbalanced set would reproduce exactly the deep-skin blind spot the
engine already had.

For each subject record:

| field | how |
| --- | --- |
| `photo` | Neutral daylight, no makeup, no filter, hair pulled back, plain background. Same capture protocol as the in-app scan. |
| `skin`, `hair`, `eye` | Sampled by the same browser code the product uses (`src/lib/image.ts`), so validation measures the *shipped pipeline*, not an idealised one. |
| `expected` | Season assigned by a **trained colour analyst** working from draped in-person analysis, not from the photo. |
| `analystId` | Which analyst. Required for the agreement check below. |
| `confidence` | Analyst's own confidence. Low-confidence labels get excluded from the headline metric. |

### Inter-rater agreement first

Have **at least two analysts independently label an overlapping subset of ~40
subjects** before measuring the engine against either of them.

This is not optional. Trained analysts disagree with each other, and their
agreement rate is the **ceiling** on any achievable engine score. If two humans
agree only 70% of the time on exact season, then an engine scoring 70% is
performing at human level, and chasing 90% is chasing noise. Without this number
the engine's accuracy is uninterpretable.

The statistics are implemented and unit-tested in `src/lib/agreement.ts`
(40 assertions in `scripts/agreement.test.mjs`, verified against
hand-computed worked examples):

| statistic | when |
| --- | --- |
| **Cohen's kappa** | exactly two analysts |
| **Fleiss' kappa** | three or more analysts |
| **Weighted Cohen's kappa** | the honest headline — see below |

```
kappa = (p_o - p_e) / (1 - p_e)
```

Run `npm run agreement`. It prints the human ceiling **first** and reports engine
accuracy as a ratio against it. With no data it says so and exits cleanly.

#### Why weighted kappa is the headline

Unweighted kappa treats every disagreement as equally wrong. But the twelve
seasons are not nominal categories — they are structured on the same
hue/value/chroma axes the engine uses. Confusing **True Spring with Light
Spring** (same family, one variant off) is a far smaller error than confusing
**True Spring with Deep Winter** (opposite on every axis).

`seasonDistance()` encodes that structure, weighting hue heaviest because
crossing warm/cool is the one mistake that makes recommended colours actively
unflattering rather than merely suboptimal:

```
True Spring  vs Light Spring   -> 0.22   near miss, same family
True Spring  vs True Autumn    -> 0.33   same hue, different character
Light Spring vs Light Summer   -> 0.78   hue flip
True Spring  vs Deep Winter    -> 1.00   opposite on every axis
```

A smoke run over five subjects with two same-family disagreements scored
**0.545 unweighted vs 0.859 weighted** — the unweighted figure materially
understates real analyst agreement.

#### Consensus rules

- `ratings[]` is **append-only raw data**, never mutated or back-filled from
  consensus. Kappa is computed only from it.
- `consensus` records **how** it was reached: `unanimous`, `majority`,
  `adjudicated`, or `unresolved`.
- A plurality without a majority stays **unresolved**. It is retained in the
  file and flagged `includeInHeadline: false` — never deleted. Unresolved cases
  are the hard ones, and dropping them silently inflates apparent accuracy. The
  scorer warns when exclusions exceed 20%.
- Engine predictions are **never stored** alongside labels; they are computed at
  scoring time.

### Sourcing

Colour analysts are findable through professional associations and independent
studios; expect to pay for labelling time. Budget this as research cost — a
defensible accuracy number against expert labels is the only thing that turns
"our colour engine" from a claim into an asset, and it is the one thing a
competitor cannot copy from the repository.

## Honest claims

Until `labelled-photos.json` exists, the defensible public claim is:

> Measures skin, hair and eye colour in CIELAB and classifies via the
> three-axis dominance model used in twelve-tone analysis. Reproduces the
> published definition on 24 reference archetypes; agreement with human
> analysts on real faces has not yet been measured.

Do **not** claim accuracy, clinical validity, or that it matches a professional
consultation.
