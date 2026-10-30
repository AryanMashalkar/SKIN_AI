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

// --- cross-check: photo sample vs YouCam -----------------------------------------
const { resolveTone, SKIN_AGREE_DELTA_E, DISAGREE_CONFIDENCE_CAP } = await import("../src/lib/tone-crosscheck.ts");
const base = { hair: "#1c1410", eye: "#2b1a12", hairEyeBy: "youcam", photoConfident: true };

assert("no reading at all -> no tone", resolveTone({ ...base }) === null);

const photoOnly = resolveTone({ ...base, photoSkin: "#b07a5a" });
assert("photo only: skin from the photo", photoOnly.measuredBy === "photo-sample" && photoOnly.hex === "#b07a5a");
assert("photo only: no cross-check", photoOnly.crossCheck === undefined);
assert("hair/eye source is recorded", photoOnly.hairEyeBy === "youcam");

const youcamOnly = resolveTone({ ...base, youcamSkin: "#715544", youcamLighting: "good" });
assert("YouCam only: skin from YouCam", youcamOnly.measuredBy === "youcam" && youcamOnly.hex === "#715544");
assert("YouCam only with good lighting: not low confidence", youcamOnly.lowConfidence === false);
assert("YouCam only with poor lighting: low confidence", resolveTone({ ...base, youcamSkin: "#715544", youcamLighting: "dark" }).lowConfidence === true);

const same = resolveTone({ ...base, photoSkin: "#b07a5a", youcamSkin: "#b07a5a" });
assert("identical readings agree", same.crossCheck.agree === true && same.crossCheck.deltaE === 0);
assert("agreement keeps confidence", same.lowConfidence === false && same.analysis.confidence === photoOnly.analysis.confidence);

// The case seen live: YouCam read a medium-brown face much darker.
const split = resolveTone({ ...base, photoSkin: "#b07a5a", youcamSkin: "#715544" });
assert("the photo sample leads when both exist", split.measuredBy === "photo-sample" && split.hex === "#b07a5a");
assert("both readings are reported", split.crossCheck.photoHex === "#b07a5a" && split.crossCheck.youcamHex === "#715544");
assert("a large gap is a disagreement", split.crossCheck.deltaE > SKIN_AGREE_DELTA_E && split.crossCheck.agree === false);
assert("disagreement lowers confidence", split.lowConfidence === true);
assert(
  "confidence is capped exactly when the seasons differ",
  split.crossCheck.photoSeason !== split.crossCheck.youcamSeason
    ? split.analysis.confidence <= DISAGREE_CONFIDENCE_CAP
    : split.analysis.confidence === photoOnly.analysis.confidence,
);

const near = resolveTone({ ...base, photoSkin: "#b07a5a", youcamSkin: "#b27c5c" });
assert("a small gap in the same season agrees", near.crossCheck.deltaE <= SKIN_AGREE_DELTA_E && near.crossCheck.agree === (near.crossCheck.photoSeason === near.crossCheck.youcamSeason));
const shaky = resolveTone({ ...base, photoSkin: "#b07a5a", youcamSkin: "#b07a5a", photoConfident: false });
assert("an unconfident photo sample stays low confidence even when YouCam agrees", shaky.lowConfidence === true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
