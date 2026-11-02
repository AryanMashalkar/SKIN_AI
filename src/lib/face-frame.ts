// Decides how to reframe a selfie so Skin Analysis can read the face.
//
// YouCam rejects photos where the face is small in the frame
// (`error_src_face_too_small`), and a phone selfie held at arm's length often
// is. In testing, a selfie with the face at 45% of the frame width was rejected
// and a crop of the same photo at 80% was accepted.
//
// Pure and deterministic; unit-tested in scripts/face-frame.test.mjs.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A face at least this share of the frame width is left alone. */
export const FACE_FILLS_FRAME = 0.62;
/** Share of the crop's width the face should fill after reframing. */
const TARGET_FACE_SHARE = 0.75;
/** Room above the landmarks (which stop at the forehead), so hair stays in. */
const HEADROOM = 0.3;
const PORTRAIT = 4 / 3; // height / width

/**
 * Returns the 3:4 crop to use, as fractions of the frame, or null when the
 * face already fills enough of it or the face box is unusable.
 */
export function faceFocus(face: Box, frameW: number, frameH: number): Box | null {
  if (face.w <= 0 || face.h <= 0 || frameW <= 0 || frameH <= 0) return null;
  if (face.w / frameW >= FACE_FILLS_FRAME) return null;

  let w = face.w / TARGET_FACE_SHARE;
  let h = w * PORTRAIT;
  if (h > frameH) {
    h = frameH;
    w = h / PORTRAIT;
  }
  if (w > frameW) {
    w = frameW;
    h = w * PORTRAIT;
  }

  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
  const x = clamp(face.x + face.w / 2 - w / 2, frameW - w);
  const y = clamp(face.y - face.h * HEADROOM, frameH - h);
  return { x: x / frameW, y: y / frameH, w: w / frameW, h: h / frameH };
}
