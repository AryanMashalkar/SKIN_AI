"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Camera,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  ShoppingBag,
} from "lucide-react";
import { useFashion } from "@/lib/fashion/store";
import { garmentById } from "@/lib/fashion/products";
import { preparePhoto } from "@/lib/fashion/photo";
import { useStore } from "@/lib/store";
import {
  requestCameraStream,
  waitForVideoElement,
  attachStream,
  waitForStableFrame,
  captureStill,
  stopStream,
} from "@/lib/camera";
import { styleForGarment } from "@/lib/fashion/styling";

/**
 * Gate component. The body mounts only while a garment is selected, so its
 * state (size, camera, notes) is fresh on every open. That removes two
 * reset-on-change effects which were setting state synchronously and forcing
 * an extra render pass each time the modal opened.
 *
 * Keying on `tryOnFor` also resets state when the user jumps straight from one
 * garment to another without closing - which the old effects handled only by
 * accident.
 */
export function TryOnModal() {
  const tryOnFor = useFashion((s) => s.tryOnFor);
  const garment = tryOnFor ? garmentById(tryOnFor) : undefined;
  if (!tryOnFor || !garment) return null;
  return <TryOnModalBody key={tryOnFor} tryOnFor={tryOnFor} garment={garment} />;
}

function TryOnModalBody({
  tryOnFor,
  garment,
}: {
  tryOnFor: string;
  garment: NonNullable<ReturnType<typeof garmentById>>;
}) {
  const close = useFashion((s) => s.closeTryOn);
  const userPhoto = useFashion((s) => s.userPhoto);
  const setUserPhoto = useFashion((s) => s.setUserPhoto);
  const results = useFashion((s) => s.results);
  const statusMap = useFashion((s) => s.status);
  const setResult = useFashion((s) => s.setResult);
  const setStatus = useFashion((s) => s.setStatus);
  const addGarment = useStore((s) => s.addGarment);

  const skinProfile = useStore((s) => s.profile);

  const result = results[tryOnFor];
  const status = statusMap[tryOnFor] ?? "idle";

  const [camera, setCamera] = useState(false);
  const [warming, setWarming] = useState(false);
  const [note, setNote] = useState<string>("");
  const [size, setSize] = useState<string>(garment.sizes[0] ?? "");
  const [added, setAdded] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  // Stop any live camera track when the modal unmounts. This is a real side
  // effect on an external resource, so it stays in an effect.
  useEffect(() => stopCamera, [stopCamera]);

  const skinVerdict = skinProfile ? styleForGarment(skinProfile, garment) : null;

  async function handleFile(file: File) {
    try {
      const photo = await preparePhoto(file);
      setUserPhoto(photo);
      stopCamera();
      setCamera(false);
    } catch {
      setNote("Couldn't read that image. Try another photo.");
    }
  }

  async function startCamera() {
    setCamera(true);
    setWarming(true);
    let stream: MediaStream | null = null;
    try {
      // Request first: this is the slow step, and it also gives React time to
      // commit the <video> that `setCamera(true)` just scheduled.
      stream = await requestCameraStream({ facingMode: "user" });
      const video = await waitForVideoElement(videoRef);
      if (!video) throw new Error("Camera preview failed to mount.");

      streamRef.current = stream;
      await attachStream(video, stream);
      // `play()` resolving does not mean the sensor has settled; a dark first
      // frame makes a poor try-on source.
      await waitForStableFrame(video);
    } catch {
      // Never leak the camera if we bailed after acquiring it.
      if (stream && streamRef.current !== stream) stopStream(stream);
      setCamera(false);
      setNote("Camera unavailable — upload a photo instead.");
    } finally {
      setWarming(false);
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    try {
      const shot = await captureStill(video, 0.9);
      if (shot.underexposed) {
        setNote("That frame looked very dark — try more light for a better try-on.");
      }
      await handleFile(new File([shot.blob], "camera.jpg", { type: "image/jpeg" }));
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't capture from the camera.");
    }
  }

  async function runTryOn() {
    if (!userPhoto || !garment) return;
    setStatus(garment.id, "running");
    setNote("");
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPhotoDataUrl: userPhoto.dataUrl,
          garmentId: garment.id,
        }),
      });
      const data = await res.json();
      if (data.resultUrl) setResult(garment.id, data.resultUrl);
      setStatus(garment.id, "done");
      if (data.source === "mock" && data.note) setNote(data.note);
    } catch {
      setStatus(garment.id, "error");
      setNote("Try-on failed. Please try again.");
    }
  }

  function handleAdd() {
    addGarment(garment, size);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 grid w-full max-w-3xl animate-float-in grid-cols-1 overflow-hidden rounded-3xl bg-neutral-900 text-white shadow-2xl md:grid-cols-2">
        <button
          onClick={close}
          aria-label="Close try-on"
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white/70 hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left: your photo */}
        <div className="flex flex-col border-b border-white/10 p-5 md:border-b-0 md:border-r">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Your photo
          </p>

          {camera ? (
            <div className="mt-3 space-y-3">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
                {/* Framing guide. Apparel VTO places a garment on a torso, so a
                    head-and-shoulders crop gives it almost nothing to work
                    with - the usual result is an image that comes back looking
                    unchanged. A laptop webcam at typing distance produces
                    exactly that crop, so the guide has to be explicit. */}
                <div className="pointer-events-none absolute inset-x-[14%] inset-y-[10%] rounded-xl border-2 border-dashed border-white/50" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-center">
                  <p className="text-[11px] leading-snug text-white/85">
                    Step back so your <strong>whole torso</strong> fits the box —
                    head to waist, arms slightly out.
                  </p>
                </div>
                {warming && (
                  <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-[2px]">
                    <p className="text-xs text-white/80">Letting the camera adjust…</p>
                  </div>
                )}
              </div>
              <button
                onClick={capture}
                disabled={warming}
                className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {warming ? "Adjusting…" : "Capture"}
              </button>
            </div>
          ) : userPhoto ? (
            <div className="mt-3 space-y-3">
              <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={userPhoto.previewUrl}
                  alt="Your photo"
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                onClick={() => setUserPhoto(null)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" /> Change photo
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-1 flex-col justify-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-white/80">
                  For a good try-on
                </p>
                <ul className="mt-1.5 space-y-1 text-xs leading-snug text-white/50">
                  <li>• Head to waist in frame — not a close-up of your face</li>
                  <li>• Arms slightly away from your sides</li>
                  <li>• Bright, even light and a plain wall behind you</li>
                </ul>
                <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-snug text-white/40">
                  A laptop webcam at desk distance only captures head and
                  shoulders, which the AI can&apos;t dress — use your phone, or
                  step back.
                </p>
              </div>
              <button
                onClick={startCamera}
                className="flex items-center gap-3 rounded-2xl border border-white/15 p-3 text-left transition hover:bg-white/5"
              >
                <Camera className="h-5 w-5 text-white/70" />
                <span className="text-sm font-medium">Use camera</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-3 rounded-2xl border border-white/15 p-3 text-left transition hover:bg-white/5"
              >
                <Upload className="h-5 w-5 text-white/70" />
                <span className="text-sm font-medium">Upload a photo</span>
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
        </div>

        {/* Right: garment + result */}
        <div className="flex flex-col p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">
            {garment.brand} · {garment.category}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{garment.name}</h2>

          {skinVerdict && (
            <p
              className={`mt-1.5 flex items-start gap-1.5 text-xs leading-snug ${
                skinVerdict.caution ? "text-amber-300/80" : "text-emerald-300/80"
              }`}
            >
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{skinVerdict.reason}</span>
            </p>
          )}

          <div className="relative mt-3 aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result || garment.image}
              alt={garment.name}
              className="h-full w-full object-cover"
            />
            {status === "running" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="text-sm text-white/80">Dressing you…</p>
                <p className="text-xs text-white/50">This can take ~15–30s</p>
              </div>
            )}
            {result && status !== "running" && (
              <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-900">
                <Sparkles className="h-3 w-3" /> AI try-on
              </span>
            )}
          </div>

          {note && <p className="mt-2 text-xs text-amber-300/80">{note}</p>}

          {/* Actions */}
          <div className="mt-4 space-y-3">
            {!result || status === "running" ? (
              <button
                onClick={runTryOn}
                disabled={!userPhoto || status === "running"}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-neutral-900 transition disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                {status === "running" ? "Generating…" : "Try it on"}
              </button>
            ) : (
              <button
                onClick={runTryOn}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Size
                </span>
                <span className="text-xs text-white/60">
                  Selected: <span className="font-semibold text-white">{size || "—"}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {garment.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={size === s}
                    onClick={() => setSize(s)}
                    className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      size === s
                        ? "border-white bg-white text-neutral-900"
                        : "border-white/20 text-white/70 hover:border-white/40 hover:bg-white/10"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-white/40">
                The AI fits the garment to your body — size is for your order, so
                the preview looks the same across sizes.
              </p>
              <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-snug text-white/40">
                Your photo is uploaded to temporary storage only so the try-on
                service can fetch it, and is deleted as soon as the render
                finishes. It isn&apos;t kept after you close this window.
              </p>
            </div>

            <button
              onClick={handleAdd}
              disabled={!size}
              className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition disabled:opacity-40 ${
                added ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-900 hover:bg-white"
              }`}
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Added to bag · Size {size}
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" /> Add to bag · ${garment.price}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
