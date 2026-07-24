"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Camera,
  ScanFace,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { preprocessImage } from "@/lib/image";

type Phase = "choose" | "camera" | "preview" | "analyzing" | "error";

const STEPS = [
  "Uploading securely…",
  "Detecting facial landmarks…",
  "Scoring 11 skin concerns…",
  "Matching products to your skin…",
];

export function ScanModal() {
  const open = useStore((s) => s.scanOpen);
  const close = useStore((s) => s.closeScan);
  const setProfile = useStore((s) => s.setProfile);

  const [phase, setPhase] = useState<Phase>("choose");
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    setPhase("choose");
    setPreview(null);
    setBlob(null);
    setError("");
    setStep(0);
  }, [stopCamera]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

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
      setPhase("preview");
    } catch {
      setError("We couldn't read that image. Try a clear, front-facing photo.");
      setPhase("error");
    }
  }

  async function startCamera() {
    setPhase("camera");
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
      setError("Camera access was blocked. You can upload a photo instead.");
      setPhase("error");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    const captured = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.95),
    );
    if (captured) {
      await handleFile(new File([captured], "camera.jpg", { type: "image/jpeg" }));
    }
  }

  async function analyze() {
    if (!blob) return;
    setPhase("analyzing");
    setStep(0);
    try {
      const form = new FormData();
      form.append("image", new File([blob], "scan.jpg", { type: "image/jpeg" }));
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
      <div className="relative z-10 w-full max-w-md animate-float-in overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-violet-600" />
            <h2 className="font-semibold text-stone-900">AI Skin Analysis</h2>
          </div>
          <button
            onClick={close}
            className="grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {phase === "choose" && (
            <div className="space-y-3">
              <p className="text-sm text-stone-500">
                Take or upload a clear, front-facing selfie in good light. Keep
                your <span className="font-medium text-stone-700">whole head and
                shoulders in frame</span> — don&apos;t crop the top of your head —
                and get close enough that your face fills most of the photo.
              </p>
              <button
                onClick={startCamera}
                className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50/50"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-600">
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
                className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50/50"
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
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-900">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
                <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-white/60" />
              </div>
              <p className="text-center text-xs text-stone-500">
                Fit your whole head inside the guide, shoulders visible.
              </p>
              <button
                onClick={capture}
                className="w-full rounded-full bg-violet-600 py-3 font-medium text-white transition hover:bg-violet-700"
              >
                Capture
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
                  className="aspect-[3/4] w-full object-cover"
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
                <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
                <ScanFace className="absolute inset-0 m-auto h-5 w-5 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-stone-700">{STEPS[step]}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-700"
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
