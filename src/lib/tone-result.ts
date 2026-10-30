// Parsing for the YouCam Facial Color Tones Analyzer's result. Pure, so it is
// unit-tested (scripts/tone.test.mjs); the network client is lib/tone-api.ts.

const HEX = /^#[0-9a-f]{6}$/i;

export interface MeasuredColours {
  skin: string;
  eye?: string;
  hair?: string;
  eyeName?: string;
  hairName?: string;
  /** YouCam's own capture-quality read: "good" or a reason it is not. */
  lighting?: string;
}

/** Validates a colour from the API: a 6-digit hex, lower-cased, or undefined. */
function hex(v: unknown): string | undefined {
  return typeof v === "string" && HEX.test(v) ? v.toLowerCase() : undefined;
}

/**
 * Pulls the colours out of a finished task. Throws when there is no usable
 * skin colour, so the caller falls back to the in-browser sample instead of
 * feeding the season engine a blank.
 */
export function parseToneResult(data: unknown): MeasuredColours {
  const results = (data as { results?: Record<string, unknown> })?.results ?? {};
  const color = (results.color ?? {}) as Record<string, unknown>;
  const quality = (results.face_quality ?? {}) as Record<string, unknown>;
  const skin = hex(color.skin_color);
  if (!skin) throw new Error("tone result has no skin_color");
  return {
    skin,
    eye: hex(color.eye_color),
    hair: hex(color.hair_color),
    eyeName: typeof color.eye_color_name === "string" ? color.eye_color_name : undefined,
    hairName: typeof color.hair_color_name === "string" ? color.hair_color_name : undefined,
    lighting: typeof quality.lighting === "string" ? quality.lighting : undefined,
  };
}
