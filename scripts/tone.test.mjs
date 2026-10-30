// YouCam Facial Color Tones Analyzer result parsing. Run with: npm test

import { parseToneResult } from "../src/lib/tone-result.ts";
import { analyzeAppearance } from "../src/lib/season.ts";

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

// The documented success payload (docs.perfectcorp.com/reference/ai_skin_tone_analysis).
const documented = {
  task_status: "success",
  results: {
    face_quality: { has_face: true, area: "good", frontal: "good", lighting: "good", faceangle: "good" },
    color: {
      eye_color: "#293F9B",
      eye_color_name: "Blue",
      lip_color: "#D23245",
      eyebrow_color: "#5B2B31",
      skin_color: "#b9947c",
      hair_color: "#a0a0a0",
      hair_color_name: "Auburn",
    },
  },
};

const c = parseToneResult(documented);
assert("reads skin colour", c.skin === "#b9947c");
assert("reads eye colour, lower-cased", c.eye === "#293f9b");
assert("reads hair colour", c.hair === "#a0a0a0");
assert("keeps YouCam's colour names", c.eyeName === "Blue" && c.hairName === "Auburn");
assert("reads the lighting quality", c.lighting === "good");

assert("no skin colour -> throws (caller falls back to the photo sample)", throws(() => parseToneResult({ results: { color: { eye_color: "#000000" } } })));
assert("malformed skin colour -> throws", throws(() => parseToneResult({ results: { color: { skin_color: "tan" } } })));
assert("empty payload -> throws", throws(() => parseToneResult({})));
assert("null payload -> throws", throws(() => parseToneResult(null)));

const partial = parseToneResult({ results: { color: { skin_color: "#c08a6a", eye_color: "blue", hair_color: "#12" } } });
assert("invalid eye/hair hex are dropped, not passed on", partial.eye === undefined && partial.hair === undefined);
assert("missing face_quality leaves lighting unset", partial.lighting === undefined);

// End to end: YouCam's colours drive the three-axis season engine.
const tone = analyzeAppearance({ skin: c.skin, eye: c.eye, hair: c.hair });
assert("measured colours produce a season", typeof tone.seasonLabel === "string" && tone.seasonLabel.length > 0);
assert("all three features are used", tone.analysis?.inputs.skin && tone.analysis?.inputs.hair && tone.analysis?.inputs.eye);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
