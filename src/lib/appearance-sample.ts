"use client";

// Automatic hair and eye colour sampling from the scan photo.
//
// DESIGN CONTRACT: this module only ever *suggests* a swatch. It never sets the
// value used for classification directly. Hair segmentation against a similar-
// toned background and iris colour under screen glare are both unreliable, so a
// wrong automatic reading must degrade to "a swatch the user corrects", never
// to "a wrong answer used silently".
//
// Two things make the output robust to noisy pixels:
//   1. sampled colours are reduced by MEDIAN, not mean, and specular highlights
//      and near-black shadow are discarded before the reduction;
//   2. the result is snapped to the nearest known option in CIELAB, so
//      classification only ever sees one of a small set of sane pigment values.
//
// Every failure path returns null. Detection must never block or break a scan.

import { hexToRgb, rgbToLab, type Lab } from "@/lib/color";
import {
  HAIR_OPTIONS,
  EYE_OPTIONS,
  type ColorOption,
} from "@/lib/appearance-options";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/face_landmarker.task";

// MediaPipe face-mesh indices (478-point model, iris refinement included).
const LEFT_IRIS_CENTRE = 468;
const RIGHT_IRIS_CENTRE = 473;
const FOREHEAD_TOP = 10;

export interface DetectedAppearance {
  hair: ColorOption | null;
  eye: ColorOption | null;
  /** Why a slot is null, for UI copy. */
  notes: string[];
}

// ---- lazy singleton --------------------------------------------------------

type Landmarker = {
  detect: (img: HTMLCanvasElement) => {
    faceLandmarks: Array<Array<{ x: number; y: number }>>;
  };
};

let landmarkerPromise: Promise<Landmarker | null> | null = null;

async function getLandmarker(): Promise<Landmarker | null> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        // Dynamic import: ~155 KB of JS plus WASM that most sessions never need.
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
        return (await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
          runningMode: "IMAGE",
          numFaces: 1,
        })) as unknown as Landmarker;
      } catch {
        return null; // model or WASM unavailable - fall back to manual pickers
      }
    })();
  }
  return landmarkerPromise;
}

// ---- pixel helpers ---------------------------------------------------------

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Median-reduces a pixel set after discarding glare and deep shadow. */
function reduce(pixels: RGB[]): RGB | null {
  const usable = pixels.filter((p) => {
    const l = rgbToLab(p).L;
    return l > 8 && l < 92; // drop specular highlight and crushed shadow
  });
  if (usable.length < 12) return null;
  const med = (get: (p: RGB) => number) => {
    const v = usable.map(get).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  return { r: med((p) => p.r), g: med((p) => p.g), b: med((p) => p.b) };
}

function sampleRect(
  data: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): RGB[] {
  const out: RGB[] = [];
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(data.width, Math.ceil(Math.max(x0, x1)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(data.height, Math.ceil(Math.max(y0, y1)));
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const i = (y * data.width + x) * 4;
      if (data.data[i + 3] < 200) continue;
      out.push({ r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] });
    }
  }
  return out;
}

const deltaE = (a: Lab, b: Lab) =>
  Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);

/**
 * MediaPipe's WASM build logs TFLite startup notices ("INFO: Created TensorFlow
 * Lite XNNPACK delegate for CPU") to stderr. Emscripten maps stderr to
 * console.error, and Next's dev overlay surfaces anything on console.error as a
 * red "Console Error" - so a perfectly healthy first detection looks like a
 * crash to anyone running `npm run dev`.
 *
 * This filters ONLY those known-benign notices, for the duration of one call,
 * and restores console.error in a finally so genuine errors are never hidden.
 * Anything that is not a recognised INFO/WARNING banner passes straight
 * through.
 */
function withoutBenignWasmLogs<T>(fn: () => T): T {
  const original = console.error;
  const BENIGN = /^\s*(INFO|WARNING):|XNNPACK|TensorFlow Lite|Created TensorFlow/i;

  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && BENIGN.test(first)) return;
    original(...args);
  };

  try {
    return fn();
  } finally {
    console.error = original;
  }
}

/**
 * Snaps a measured colour to the nearest catalogued pigment option.
 *
 * Exported for testing: this is where noisy CV output gets quantised into a
 * sane, discrete value, so it is the part most worth asserting on.
 */
export function nearestOption(rgb: RGB, options: ColorOption[]): ColorOption {
  const lab = rgbToLab(rgb);
  let best = options[0];
  let bestD = Infinity;
  for (const o of options) {
    const d = deltaE(lab, rgbToLab(hexToRgb(o.hex)));
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

// ---- detection -------------------------------------------------------------

/**
 * Attempts to read hair and eye colour from an already-cropped scan photo.
 * Returns nulls (with reasons) rather than guessing when the evidence is weak.
 */
export async function detectAppearance(
  source: HTMLCanvasElement,
): Promise<DetectedAppearance> {
  const notes: string[] = [];
  const landmarker = await getLandmarker();
  if (!landmarker) {
    return { hair: null, eye: null, notes: ["Automatic detection unavailable."] };
  }

  let landmarks: Array<{ x: number; y: number }> | undefined;
  try {
    landmarks = withoutBenignWasmLogs(
      () => landmarker.detect(source).faceLandmarks?.[0],
    );
  } catch {
    /* fall through */
  }
  if (!landmarks || landmarks.length < 478) {
    return {
      hair: null,
      eye: null,
      notes: ["Couldn't find a clear face — pick your colours below."],
    };
  }

  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { hair: null, eye: null, notes: [] };
  const W = source.width;
  const H = source.height;
  const img = ctx.getImageData(0, 0, W, H);

  // --- reference colours: skin (forehead) and background (corners) ----------
  const fx = landmarks[FOREHEAD_TOP].x * W;
  const fy = landmarks[FOREHEAD_TOP].y * H;
  const faceW = W * 0.28;

  const skin = reduce(
    sampleRect(img, fx - faceW * 0.3, fy + H * 0.03, fx + faceW * 0.3, fy + H * 0.07),
  );
  const corner = Math.round(Math.min(W, H) * 0.06);
  const background = reduce([
    ...sampleRect(img, 0, 0, corner, corner),
    ...sampleRect(img, W - corner, 0, W, corner),
  ]);

  // --- eye: iris tissue, avoiding the pupil --------------------------------
  // 468/473 are iris CENTRES, i.e. the pupil. Sampling a disc there returns
  // near-black regardless of actual eye colour. The surrounding ring landmarks
  // mark the limbus, so we sample partway between centre and limbus, which is
  // pigmented iris on every eye size.
  let eye: ColorOption | null = null;
  const irisR = Math.max(1, Math.round(W * 0.004));
  const IRIS_RINGS: Array<[number, number[]]> = [
    [LEFT_IRIS_CENTRE, [469, 470, 471, 472]],
    [RIGHT_IRIS_CENTRE, [474, 475, 476, 477]],
  ];
  const irisPixels = IRIS_RINGS.flatMap(([centre, ring]) =>
    ring.flatMap((r) => {
      // 60% of the way from pupil centre toward the limbus.
      const px = (landmarks![centre].x + (landmarks![r].x - landmarks![centre].x) * 0.6) * W;
      const py = (landmarks![centre].y + (landmarks![r].y - landmarks![centre].y) * 0.6) * H;
      return sampleRect(img, px - irisR, py - irisR, px + irisR, py + irisR);
    }),
  );
  const irisRgb = reduce(irisPixels);
  if (irisRgb) eye = nearestOption(irisRgb, EYE_OPTIONS);
  else notes.push("Couldn't read your eye colour clearly.");

  // --- hair: band above the hairline ---------------------------------------
  let hair: ColorOption | null = null;
  const bandTop = fy - H * 0.13;
  const bandBottom = fy - H * 0.03;
  if (bandBottom <= 0) {
    notes.push("Your hair is outside the photo — pick it below.");
  } else {
    const hairRgb = reduce(
      sampleRect(img, fx - faceW * 0.45, bandTop, fx + faceW * 0.45, bandBottom),
    );
    if (!hairRgb) {
      notes.push("Couldn't read your hair colour clearly.");
    } else {
      const hairLab = rgbToLab(hairRgb);
      // Reject the two ways this sample goes wrong: we actually caught the
      // background (bald, receding, or hair out of frame), or we caught
      // forehead skin (hairline lower than assumed).
      const looksLikeBg = background && deltaE(hairLab, rgbToLab(background)) < 14;
      const looksLikeSkin = skin && deltaE(hairLab, rgbToLab(skin)) < 12;
      if (looksLikeBg) {
        notes.push("Couldn't separate your hair from the background.");
      } else if (looksLikeSkin) {
        notes.push("Couldn't see enough hair in the frame.");
      } else {
        hair = nearestOption(hairRgb, HAIR_OPTIONS);
      }
    }
  }

  return { hair, eye, notes };
}
