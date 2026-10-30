// Chooses the skin colour the season engine uses, and cross-checks it.
//
// Two readings can exist for the same scan: our in-browser sample of the face
// (white-balanced, so it follows the photo's pixels) and YouCam's Facial Color
// Tones Analyzer. In testing, YouCam's skin colour was repeatable but read
// darker than the photo itself, which fits a lighting-normalised estimate
// rather than a measurement of the pixels. So the photo sample leads, YouCam's
// reading is shown beside it, and when the two disagree — far apart in colour,
// or landing in different seasons — confidence drops and the report says so.
//
// Pure and deterministic; unit-tested in scripts/tone.test.mjs.

import { analyzeAppearance } from "@/lib/season";
import { hexToRgb, rgbToLab, type SkinTone } from "@/lib/color";
import { deltaE } from "@/lib/fashion/colourways";

/** Skin readings within this CIE76 distance (and the same season) agree. */
export const SKIN_AGREE_DELTA_E = 10;
/** Season confidence ceiling when the two readings imply different seasons. */
export const DISAGREE_CONFIDENCE_CAP = 0.5;

export interface ToneInputs {
  /** In-browser, white-balanced sample of the face. */
  photoSkin?: string | null;
  /** Whether the in-browser sample itself was confident. */
  photoConfident: boolean;
  /** YouCam Facial Color Tones Analyzer readings. */
  youcamSkin?: string | null;
  youcamLighting?: string;
  hair?: string;
  eye?: string;
  hairEyeBy: "youcam" | "swatches";
}

const labOf = (hex: string) => rgbToLab(hexToRgb(hex));

export function resolveTone(input: ToneInputs): SkinTone | null {
  const { photoSkin, youcamSkin, hair, eye, hairEyeBy } = input;

  if (!photoSkin) {
    if (!youcamSkin) return null;
    return {
      ...analyzeAppearance({ skin: youcamSkin, hair, eye }),
      measuredBy: "youcam",
      hairEyeBy,
      lowConfidence: input.youcamLighting !== undefined && input.youcamLighting !== "good",
    };
  }

  const primary: SkinTone = {
    ...analyzeAppearance({ skin: photoSkin, hair, eye }),
    measuredBy: "photo-sample",
    hairEyeBy,
    lowConfidence: !input.photoConfident,
  };
  if (!youcamSkin) return primary;

  const other = analyzeAppearance({ skin: youcamSkin, hair, eye });
  const distance = Math.round(deltaE(labOf(photoSkin), labOf(youcamSkin)) * 10) / 10;
  const sameSeason = other.season === primary.season;
  const agree = sameSeason && distance <= SKIN_AGREE_DELTA_E;

  const tone: SkinTone = {
    ...primary,
    crossCheck: {
      photoHex: photoSkin,
      youcamHex: youcamSkin,
      deltaE: distance,
      photoSeason: primary.seasonLabel,
      youcamSeason: other.seasonLabel,
      agree,
    },
  };
  if (!agree) tone.lowConfidence = true;
  if (!sameSeason && tone.analysis) {
    tone.analysis = {
      ...tone.analysis,
      confidence: Math.min(tone.analysis.confidence, DISAGREE_CONFIDENCE_CAP),
    };
  }
  return tone;
}
