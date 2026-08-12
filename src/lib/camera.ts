"use client";

// Shared webcam capture.
//
// Both the skin scan and the try-on previously did this inline, with the same
// two defects:
//
//  1. They captured immediately after `video.play()` resolved. That promise
//     settles when playback STARTS, not when the sensor has converged - auto
//     exposure and auto white balance take roughly half a second to a second.
//     Capturing before then yields a dark, colour-cast frame.
//
//     For this app that is not merely ugly: skin colour is measured from that
//     frame in CIELAB, so an under-exposed green-cast capture produces a wrong
//     undertone, a wrong ITA and therefore a wrong colour season. A bad frame
//     silently corrupts the science.
//
//  2. They set `canvas.width = video.videoWidth` without checking it was
//     non-zero. Before metadata loads that is 0, which yields a blank capture.
//
// This module waits for real frames, verifies the capture is usable, and
// reports exposure problems instead of silently measuring a bad photo.

/** Rough perceptual luma of a frame, 0-255. */
function meanLuma(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  // Sample the central region: the subject, not the background.
  const x = Math.floor(w * 0.25);
  const y = Math.floor(h * 0.2);
  const sw = Math.max(1, Math.floor(w * 0.5));
  const sh = Math.max(1, Math.floor(h * 0.6));
  const { data } = ctx.getImageData(x, y, sw, sh);
  let sum = 0;
  let n = 0;
  // Every 16th pixel is plenty for an exposure estimate.
  for (let i = 0; i < data.length; i += 4 * 16) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++;
  }
  return n ? sum / n : 0;
}

export interface CaptureResult {
  blob: Blob;
  /** Mean luma of the subject area, 0-255. */
  luma: number;
  /** True when the frame is too dark to measure skin colour reliably. */
  underexposed: boolean;
}

/**
 * Below this a frame is rejected outright.
 *
 * Deliberately low, because the pipeline now white-balances and lifts exposure
 * (see lib/white-balance.ts) — frames that used to be unusable are recoverable.
 * Under roughly 32 even the maximum 2.2x lift lands short of a usable level and
 * is amplifying sensor noise rather than signal, so correction cannot save it.
 */
const MIN_LUMA = 32;

export interface OpenCameraOptions {
  facingMode?: "user" | "environment";
}

/**
 * Requests the camera.
 *
 * Deliberately separate from attaching it to an element. Callers show the
 * camera UI, which mounts the <video>, and React has not committed that DOM by
 * the time the call returns - so a combined "open and attach" helper invites
 * reading a ref that is still null. Request first, attach second.
 */
export async function requestCameraStream({
  facingMode = "user",
}: OpenCameraOptions = {}): Promise<MediaStream> {
  // getUserMedia is gated on a secure context. Over http:// on a LAN address -
  // which is exactly how a phone reaches `next dev` via the printed Network URL
  // - `navigator.mediaDevices` is UNDEFINED rather than merely blocked, so the
  // failure surfaces as an opaque TypeError. Detect it and say what to do.
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      window.isSecureContext === false
        ? "The camera needs a secure (https) connection. On a phone, open the https tunnel URL rather than the http LAN address — or upload a photo instead."
        : "This browser doesn't support camera capture — upload a photo instead.",
    );
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      // `ideal`, not exact: the previous code asked for a 1280x1280 square,
      // which few cameras natively provide, so the browser silently
      // substituted something else anyway.
      facingMode: { ideal: facingMode },
      width: { ideal: 1440 },
      height: { ideal: 1440 },
    },
    audio: false,
  });
}

/**
 * Waits for a conditionally-rendered <video> to actually exist.
 *
 * Guards the exact race above: setState schedules the render, it does not
 * perform it, so the ref is null on the very next line.
 */
export async function waitForVideoElement(
  ref: { current: HTMLVideoElement | null },
  timeoutMs = 3000,
): Promise<HTMLVideoElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ref.current) return ref.current;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  return ref.current;
}

/** Attaches a stream to a video element and begins playback. */
export async function attachStream(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
}

/** Releases every track on a stream. */
export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Resolves once the element reports real dimensions. */
function waitForMetadata(video: HTMLVideoElement, timeoutMs = 4000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("loadedmetadata", done);
      resolve();
    };
    video.addEventListener("loadedmetadata", done);
    setTimeout(done, timeoutMs);
  });
}

/**
 * Waits for the sensor to settle before we trust a frame.
 *
 * Counts real presented frames where available (`requestVideoFrameCallback`),
 * and also enforces a wall-clock minimum, because auto exposure and white
 * balance converge on a timer rather than a frame count.
 */
export async function waitForStableFrame(
  video: HTMLVideoElement,
  { minMs = 900, frames = 12 }: { minMs?: number; frames?: number } = {},
): Promise<void> {
  await waitForMetadata(video);

  const started = Date.now();
  const rvfc = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    }
  ).requestVideoFrameCallback?.bind(video);

  if (rvfc) {
    await new Promise<void>((resolve) => {
      let seen = 0;
      const tick = () => {
        seen++;
        if (seen >= frames && Date.now() - started >= minMs) return resolve();
        if (Date.now() - started > minMs + 2500) return resolve(); // hard cap
        rvfc(tick);
      };
      rvfc(tick);
    });
    return;
  }

  // Fallback for browsers without rVFC (notably older Safari).
  const remaining = minMs - (Date.now() - started);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
}

/**
 * Grabs a still from a live video element.
 *
 * Throws rather than returning an unusable capture, so callers cannot
 * accidentally analyse a blank frame.
 */
export async function captureStill(
  video: HTMLVideoElement,
  quality = 0.95,
): Promise<CaptureResult> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    throw new Error("The camera isn't ready yet — give it a moment and try again.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(video, 0, 0, w, h);

  const luma = meanLuma(ctx, w, h);
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Couldn't read a frame from the camera.");

  return { blob, luma, underexposed: luma < MIN_LUMA };
}
