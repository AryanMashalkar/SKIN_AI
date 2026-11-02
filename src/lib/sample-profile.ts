// One real scan of the project's author, recorded from the live site, so a
// visitor can explore the report and fitting room without uploading a photo.
// `demo` keeps it from ever becoming a progress baseline; the report labels it.

import type { SkinProfile } from "@/lib/skin";

export const SAMPLE_PROFILE = {
  "scores": {
    "moisture": 75,
    "redness": 99,
    "oiliness": 79,
    "pore": 70,
    "texture": 71,
    "acne": 84,
    "wrinkle": 77,
    "firmness": 75,
    "radiance": 84,
    "dark_circle": 68,
    "age_spot": 93
  },
  "skinAge": 30,
  "skinType": "Combination",
  "overall": 80,
  "demo": true,
  "capturedAt": "2026-11-02T09:30:00.000Z",
  "tone": {
    "hex": "#786659",
    "lab": {
      "L": 44.54265556752119,
      "a": 4.973113406598673,
      "b": 10.005411946015098
    },
    "ita": -28.6,
    "chroma": 11.2,
    "undertone": "neutral",
    "depth": "deep",
    "season": "deep-winter",
    "seasonLabel": "Deep Winter",
    "palette": [
      {
        "hex": "#1f4a3f",
        "name": "pine"
      },
      {
        "hex": "#5a1f3f",
        "name": "deep berry"
      },
      {
        "hex": "#1f2a4a",
        "name": "navy"
      },
      {
        "hex": "#6a1f2e",
        "name": "wine"
      },
      {
        "hex": "#2a2a2a",
        "name": "charcoal"
      },
      {
        "hex": "#3a5a7a",
        "name": "cool sapphire"
      }
    ],
    "headline": "Cool, deep and intense",
    "description": "Deep, cool and intense colours are yours — pine, deep berry, navy and true black. Warm, dusty shades fight your colouring.",
    "analysis": {
      "season": "deep-winter",
      "axes": {
        "hue": {
          "score": -0.016937640102445924,
          "strength": 0.016937640102445924
        },
        "value": {
          "score": -0.9918781836445362,
          "strength": 0.9918781836445362
        },
        "chroma": {
          "score": 0.028109044755550927,
          "strength": 0.028109044755550927
        }
      },
      "dominant": "value",
      "confidence": 0.5,
      "inputs": {
        "skin": true,
        "hair": true,
        "eye": true
      },
      "reasoning": [
        "Undertone reads cool (hue score -0.02).",
        "Overall depth reads deep (value -0.99).",
        "Clarity reads bright (chroma 0.03).",
        "Your dominant characteristic is value — that is what the season is named for."
      ]
    },
    "measuredBy": "photo-sample",
    "hairEyeBy": "youcam",
    "lowConfidence": true,
    "crossCheck": {
      "photoHex": "#786659",
      "youcamHex": "#a47e61",
      "deltaE": 17,
      "photoSeason": "Deep Winter",
      "youcamSeason": "Deep Autumn",
      "agree": false
    }
  },
  "sample": true
} as SkinProfile;
