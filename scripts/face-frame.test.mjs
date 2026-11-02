// node --experimental-strip-types scripts/face-frame.test.mjs
import { faceFocus, FACE_FILLS_FRAME } from "../src/lib/face-frame.ts";

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

const W = 1440;
const H = 1920;

// The real case: a face at 45% of the frame width was rejected by YouCam.
const small = { x: 400, y: 500, w: 648, h: 860 };
const crop = faceFocus(small, W, H);
assert("a small face gets reframed", crop !== null);
assert("the face fills 75% of the new frame", Math.abs(small.w / (crop.w * W) - 0.75) < 1e-9);
assert("the crop stays 3:4 portrait", Math.abs((crop.h * H) / (crop.w * W) - 4 / 3) < 1e-9);
assert("the crop stays inside the frame", crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= 1 && crop.y + crop.h <= 1);
assert("the face stays horizontally centred", Math.abs(crop.x * W + (crop.w * W) / 2 - (small.x + small.w / 2)) < 1e-9);
assert("there is room above the forehead", crop.y * H < small.y);
assert("the whole face stays in the crop", crop.y * H + crop.h * H >= small.y + small.h);

assert("a face that already fills the frame is left alone", faceFocus({ x: 200, y: 300, w: W * FACE_FILLS_FRAME, h: 1100 }, W, H) === null);

const corner = faceFocus({ x: 0, y: 0, w: 300, h: 400 }, W, H);
assert("a face in the corner clamps to the frame", corner.x === 0 && corner.y === 0);
const farCorner = faceFocus({ x: W - 300, y: H - 400, w: 300, h: 400 }, W, H);
assert("a face in the far corner clamps too", farCorner.x + farCorner.w <= 1 + 1e-9 && farCorner.y + farCorner.h <= 1 + 1e-9);

const tall = faceFocus({ x: 100, y: 10, w: 800, h: 200 }, W, 900);
assert("a short frame still fits the crop", tall.h <= 1 && tall.w <= 1);

assert("an empty face box is ignored", faceFocus({ x: 0, y: 0, w: 0, h: 0 }, W, H) === null);
assert("an empty frame is ignored", faceFocus(small, 0, 0) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
