"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Camera,
  ScanFace,
  Loader2,
  AlertCircle,
  Check,
  Sun,
  UserRound,
  Ban,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { preprocessImage } from "@/lib/image";
import { HAIR_OPTIONS, EYE_OPTIONS, type ColorOption } from "@/lib/appearance-options";
import { detectAppearance } from "@/lib/appearance-sample";
import {
  requestCameraStream,
  waitForVideoElement,
  attachStream,
  waitForStableFrame,
  captureStill,
  stopStream,
} from "@/lib/camera";

type Phase = "choose" | "camera" | "preview" | "analyzing" | "error";

const STEPS = [
  "Uploading securely…",
  "Detecting facial landmarks…",
  "Scoring 11 skin concerns…",
  "Matching products to your skin…",
];

/**
 * Gate component. The body mounts only while the scan modal is open, so all of
 * its state starts fresh each time. That removes the reset-on-close effect,
 * which set four pieces of state synchronously and forced an extra render on
 * every close.
 */
export function ScanModal() {
  const open = useStore((s) => s.scanOpen);
  if (!open) return null;
  return <ScanModalBody />;
}

function ScanModalBody() {
  const close = useStore((s) => s.closeScan);
  const setProfile = useStore((s) => s.setProfile);

  const [phase, setPhase] = useState<Phase>("choose");
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [skinHex, setSkinHex] = useState<string | null>(null);
  const [hairHex, setHairHex] = useState<string | null>(null);
  const [eyeHex, setEyeHex] = useState<string | null>(null);
  const [skinConfident, setSkinConfident] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [warming, setWarming] = useState(false);
  const [light, setLight] = useState<{ castStrength: number; exposureGain: number } | null>(null);
  const [detected, setDetected] = useState<{ hair: boolean; eye: boolean; notes: string[] } | null>(null);
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  // The modal now unmounts when it closes, so the camera track must be released
  // here. Without this the webcam stream (and its indicator light) would stay
  // live after closing - the old reset-on-close effect used to cover it.
  useEffect(() => stopCamera, [stopCamera]);

  const reset = useCallback(() => {
    stopCamera();
    setPhase("choose");
    setPreview(null);
    setBlob(null);
    setError("");
    setStep(0);
  }, [stopCamera]);

  // Cycle through progress messages while analyzing.
  useEffect(() => {
    if (phase !== "analyzing") return;
    const id = setInterval(
      () => setStep((s) => (s + 1) % STEPS.length),
      1400,
    );
    return () => clearInterval(id);
  }, [phase]);

  async function handleFile(file: File) {
    try {
      const processed = await preprocessImage(file);
      setPreview(processed.previewUrl);
      setBlob(processed.blob);
      setSkinHex(processed.skinHex);
      setSkinConfident(processed.skinConfident);
      setLight(processed.light);
      setPhase("preview");

      // Optional convenience: try to pre-select the hair/eye swatches. This is
      // fire-and-forget and never blocks the scan — if detection fails or is
      // slow, the user simply picks manually, which is always the source of
      // truth. Detection only suggests.
      setDetecting(true);
      detectAppearance(processed.canvas)
        .then((d) => {
          if (d.hair) setHairHex(d.hair.hex);
          if (d.eye) setEyeHex(d.eye.hex);
          setDetected({ hair: !!d.hair, eye: !!d.eye, notes: d.notes });
        })
        .catch(() => {
          /* manual pickers remain */
        })
        .finally(() => setDetecting(false));
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "We couldn't read that image. Try a clear, front-facing photo.",
      );
      setPhase("error");
    }
  }

  async function startCamera() {
    setPhase("camera");
    setWarming(true);
    let stream: MediaStream | null = null;
    try {
      // Request first: this is the slow step, and it also gives React time to
      // commit the <video> that `setPhase("camera")` just scheduled. Reading
      // the ref before this await returns null and silently kills the preview.
      stream = await requestCameraStream({ facingMode: "user" });
      const video = await waitForVideoElement(videoRef);
      if (!video) throw new Error("Camera preview failed to mount.");

      streamRef.current = stream;
      await attachStream(video, stream);
      // Let exposure and white balance converge before the shutter is usable.
      // Capturing early is what produced dark, green-cast selfies - and since
      // skin colour is measured from this frame, that corrupts the season.
      await waitForStableFrame(video);
    } catch {
      // Never leak the camera if we bailed after acquiring it.
      if (stream && streamRef.current !== stream) stopStream(stream);
      setError("Camera access was blocked. You can upload a photo instead.");
      setPhase("error");
    } finally {
      setWarming(false);
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    try {
      const shot = await captureStill(video, 0.95);
      stopCamera();
      if (shot.underexposed) {
        // Do not silently measure a bad frame: an under-exposed capture gives a
        // wrong undertone and therefore a wrong colour season.
        setError(
          "That looked too dark to read your colouring accurately. Face a window or turn a light on, then try again.",
        );
        setPhase("error");
        return;
      }
      await handleFile(new File([shot.blob], "camera.jpg", { type: "image/jpeg" }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't capture from the camera.",
      );
      setPhase("error");
    }
  }

  async function analyze() {
    if (!blob) return;
    setPhase("analyzing");
    setStep(0);
    try {
      const form = new FormData();
      form.append("image", new File([blob], "scan.jpg", { type: "image/jpeg" }));
      if (skinHex) form.append("skinHex", skinHex);
      if (hairHex) form.append("hairHex", hairHex);
      if (eyeHex) form.append("eyeHex", eyeHex);
      form.append("skinConfident", String(skinConfident));
      const res = await fetch("/api/skin/analyze", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setProfile(data.profile);
      close();
      requestAnimationFrame(() => {
        document
          .getElementById("report")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("Analysis failed. Please try again.");
      setPhase("error");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm"
        onClick={close}
      />
      {/* The shell is capped to the viewport and lays out as a column: a fixed
          header with a scrollable body. Without this the preview image plus the
          hair/eye swatches overflow the bottom of the screen on laptops, and
          the Analyze button becomes unreachable. */}
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-md animate-float-in flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-[#b5451f]" />
            <h2 className="font-semibold text-stone-900">AI Skin Analysis</h2>
          </div>
          <button
            onClick={close}
            aria-label="Close skin scan"
            className="grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {phase === "choose" && (
            <div className="space-y-3">
              <p className="text-sm text-stone-500">
                Take or upload a clear, front-facing selfie in good light — we
                score 11 skin concerns from it in seconds.
              </p>

              {/* Photo tips: helps anyone get an accepted scan on the first try. */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  For an accurate scan
                </p>
                <ul className="mt-2.5 space-y-2">
                  {[
                    { icon: UserRound, text: "Whole head & shoulders in frame — don't crop the top of your head" },
                    { icon: ScanFace, text: "Get close so your face fills most of the photo" },
                    { icon: Sun, text: "Bright, even light — face a window, avoid harsh shadows" },
                    { icon: Check, text: "Look straight at the camera, neutral expression, eyes open" },
                  ].map((t) => (
                    <li key={t.text} className="flex items-start gap-2.5 text-xs text-stone-600">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                        <t.icon className="h-3 w-3" />
                      </span>
                      <span>{t.text}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2.5 text-xs text-stone-600">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-500">
                      <Ban className="h-3 w-3" />
                    </span>
                    <span>No beauty filters, sunglasses, or hats — they skew the results</span>
                  </li>
                </ul>
                <p className="mt-3 border-t border-stone-200 pt-2.5 text-[11px] text-stone-400">
                  Scanning a friend? Get their okay first. Your photo is sent to
                  Perfect Corp&apos;s AI for analysis, held only for the moments
                  that takes, then discarded — we keep no copy and no health or
                  medical record. Scores are cosmetic guidance, not medical
                  advice.
                </p>
              </div>

              <button
                onClick={startCamera}
                className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 p-4 text-left transition hover:border-[#d9a679] hover:bg-[#faf5ee]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f4ead9] text-[#b5451f]">
                  <Camera className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-medium text-stone-900">
                    Use camera
                  </span>
                  <span className="block text-xs text-stone-500">
                    Live capture from your webcam
                  </span>
                </span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 p-4 text-left transition hover:border-[#d9a679] hover:bg-[#faf5ee]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-stone-100 text-stone-600">
                  <Upload className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-medium text-stone-900">
                    Upload a photo
                  </span>
                  <span className="block text-xs text-stone-500">
                    JPG or PNG from your device
                  </span>
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          )}

          {phase === "camera" && (
            <div className="space-y-3">
              <div className="relative max-h-[42dvh] aspect-square overflow-hidden rounded-2xl bg-stone-900">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
                <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-white/60" />
                {warming && (
                  <div className="absolute inset-0 grid place-items-center bg-stone-900/55 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-2 text-white">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="text-xs">Letting the camera adjust…</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-stone-500">
                Fit your whole head inside the guide, shoulders visible.
              </p>
              <button
                onClick={capture}
                disabled={warming}
                className="w-full rounded-full bg-[#b5451f] py-3 font-medium text-white transition hover:bg-[#93381a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {warming ? "Adjusting…" : "Capture"}
              </button>
            </div>
          )}

          {phase === "preview" && preview && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Your scan preview"
                  className="max-h-[38dvh] w-full rounded-2xl object-cover"
                />
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-3">
                <p className="text-xs font-semibold text-stone-700">
                  Hair &amp; eye colour{" "}
                  <span className="font-normal text-stone-400">(optional)</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                  Colour season is judged on all three together. Skip this and we
                  analyse from skin alone, with lower confidence.
                </p>

                {/* Say when the reading leaned on a correction. The scan still
                    works in a dim room - but the user should know the answer
                    was recovered rather than cleanly measured. */}
                {light && (light.castStrength > 0.35 || light.exposureGain > 1.4) && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-700">
                    Your lighting looked dim or colour-tinted, so we corrected
                    for it before measuring. The reading is usable — daylight
                    would make it more certain.
                  </p>
                )}

                {detecting && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> Looking at your
                    photo…
                  </p>
                )}
                {!detecting && detected && (detected.hair || detected.eye) && (
                  <p className="mt-1.5 text-[11px] text-[#b5451f]">
                    We pre-selected what we saw — change anything that looks
                    wrong.
                  </p>
                )}
                {!detecting &&
                  detected?.notes.map((n) => (
                    <p key={n} className="mt-1.5 text-[11px] text-stone-400">
                      {n}
                    </p>
                  ))}

                <SwatchRow
                  title="Hair"
                  options={HAIR_OPTIONS}
                  value={hairHex}
                  onChange={setHairHex}
                />
                <SwatchRow
                  title="Eyes"
                  options={EYE_OPTIONS}
                  value={eyeHex}
                  onChange={setEyeHex}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 rounded-full border border-stone-300 py-3 font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  Retake
                </button>
                <button
                  onClick={analyze}
                  className="flex-[2] rounded-full bg-stone-900 py-3 font-medium text-white transition hover:bg-stone-700"
                >
                  Analyze my skin
                </button>
              </div>
            </div>
          )}

          {phase === "analyzing" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-[#b5451f]" />
                <ScanFace className="absolute inset-0 m-auto h-5 w-5 text-[#b5451f]" />
              </div>
              <p className="text-sm font-medium text-stone-700">{STEPS[step]}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-[#b5451f] transition-all duration-700"
                  style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertCircle className="h-10 w-10 text-rose-500" />
              <p className="text-sm text-stone-600">{error}</p>
              <button
                onClick={reset}
                className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Selectable colour swatches. Toggles off when the active one is re-clicked,
 *  so "I would rather not say" stays reachable without a separate control. */
function SwatchRow({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: ColorOption[];
  value: string | null;
  onChange: (hex: string | null) => void;
}) {
  return (
    <div className="mt-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {title}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={`${title} colour`}>
        {options.map((o) => {
          const active = value === o.hex;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(active ? null : o.hex)}
              title={o.label}
              aria-label={o.label}
              aria-pressed={active}
              className={`h-6 w-6 shrink-0 rounded-full border-2 transition ${
                active
                  ? "border-[#b5451f] ring-2 ring-[#e9d9be]"
                  : "border-stone-200 hover:border-stone-400"
              }`}
              style={{ background: o.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
