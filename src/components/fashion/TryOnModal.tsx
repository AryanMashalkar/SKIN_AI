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
import { styleForGarment } from "@/lib/fashion/styling";

export function TryOnModal() {
  const tryOnFor = useFashion((s) => s.tryOnFor);
  const close = useFashion((s) => s.closeTryOn);
  const userPhoto = useFashion((s) => s.userPhoto);
  const setUserPhoto = useFashion((s) => s.setUserPhoto);
  const results = useFashion((s) => s.results);
  const statusMap = useFashion((s) => s.status);
  const setResult = useFashion((s) => s.setResult);
  const setStatus = useFashion((s) => s.setStatus);
  const addToCart = useFashion((s) => s.addToCart);

  const skinProfile = useStore((s) => s.profile);

  const garment = tryOnFor ? garmentById(tryOnFor) : undefined;
  const result = tryOnFor ? results[tryOnFor] : undefined;
  const status = tryOnFor ? statusMap[tryOnFor] ?? "idle" : "idle";

  const [camera, setCamera] = useState(false);
  const [note, setNote] = useState<string>("");
  const [size, setSize] = useState<string>("");
  const [added, setAdded] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!tryOnFor) {
      stopCamera();
      setCamera(false);
      setNote("");
      setAdded(false);
    }
  }, [tryOnFor, stopCamera]);

  useEffect(() => {
    setSize(garment?.sizes[0] ?? "");
  }, [garment]);

  if (!tryOnFor || !garment) return null;

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 1280 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCamera(false);
      setNote("Camera blocked — upload a photo instead.");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.9),
    );
    if (blob) await handleFile(new File([blob], "camera.jpg", { type: "image/jpeg" }));
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
    addToCart(garment!, size);
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
              <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
              </div>
              <button
                onClick={capture}
                className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-neutral-900"
              >
                Capture
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
              <p className="text-sm text-white/50">
                Use a clear, front-facing photo showing your upper or full body,
                arms slightly away from your sides.
              </p>
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
