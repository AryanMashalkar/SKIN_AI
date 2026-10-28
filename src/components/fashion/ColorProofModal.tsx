"use client";

import { useRef, useState } from "react";
import {
  X,
  Upload,
  Camera,
  Sparkles,
  Loader2,
  Check,
  Ban,
  Wand2,
} from "lucide-react";
import { useFashion } from "@/lib/fashion/store";
import { useStore } from "@/lib/store";
import { GARMENTS } from "@/lib/fashion/products";
import { preparePhoto } from "@/lib/fashion/photo";
import { proofForSkin } from "@/lib/fashion/styling";
import type { Colourway } from "@/lib/fashion/colourways";
import { recolorGarment } from "@/lib/fashion/recolor";

type Phase = "need-photo" | "ready" | "running" | "done" | "error";

interface Side {
  url: string;
  live: boolean;
}

/**
 * Gate component. Mounting the body only while open means its state is fresh
 * on every open, which removes the reset-on-open effect entirely - that effect
 * was setting state synchronously during render commit and causing a second
 * render pass every time the modal appeared.
 */
export function ColorProofModal() {
  const open = useFashion((s) => s.proofOpen);
  if (!open) return null;
  return <ColorProofModalBody />;
}

function ColorProofModalBody() {
  const close = useFashion((s) => s.closeProof);
  const userPhoto = useFashion((s) => s.userPhoto);
  const setUserPhoto = useFashion((s) => s.setUserPhoto);
  const profile = useStore((s) => s.profile);
  const tone = profile?.tone;

  const [phase, setPhase] = useState<Phase>(userPhoto ? "ready" : "need-photo");
  const [flat, setFlat] = useState<Side | null>(null);
  const [clash, setClash] = useState<Side | null>(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // One garment, two of its own colourways: our pick vs. the colour in the
  // product photo (what the shopper would otherwise have bought).
  const proof = tone && profile ? proofForSkin(profile, GARMENTS) : null;
  const garment = proof?.garment ?? GARMENTS[0];
  const contrastTitle = proof?.contrastIs === "as-pictured" ? "As pictured" : "Worst for you";

  async function handleFile(file: File) {
    try {
      const photo = await preparePhoto(file);
      setUserPhoto(photo);
      setPhase("ready");
    } catch {
      setNote("Couldn't read that image. Try another photo.");
    }
  }

  async function runOne(colourway: Colourway): Promise<Side> {
    // The photographed colour goes by id so the server uses the stored photo.
    const garmentImageDataUrl = colourway.original
      ? undefined
      : await recolorGarment(garment.image, colourway.hex);
    const res = await fetch("/api/tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPhotoDataUrl: userPhoto!.dataUrl,
        garmentId: garment.id,
        garmentImageDataUrl,
      }),
    });
    const data = await res.json();
    return {
      url: data.resultUrl || garmentImageDataUrl || garment.image,
      live: data.source === "perfectcorp",
    };
  }

  async function generate() {
    if (!userPhoto || !proof) return;
    setPhase("running");
    setNote("");
    try {
      const [f, c] = await Promise.all([
        runOne(proof.best.colourway),
        runOne(proof.contrast.colourway),
      ]);
      setFlat(f);
      setClash(c);
      setPhase("done");
      if (!f.live || !c.live)
        setNote("Showing recoloured previews (live try-on unavailable here).");
    } catch {
      setPhase("error");
      setNote("Proof generation failed. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl animate-float-in flex-col overflow-y-auto rounded-3xl bg-neutral-900 text-white shadow-2xl">
        <button
          onClick={close}
          aria-label="Close proof"
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white/70 hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#d9a679]/85">
            <Wand2 className="h-4 w-4" /> Prove it on your photo
          </div>
          <h2 className="mt-1 text-lg font-semibold">
            {proof
              ? `The ${garment.name}: ${proof.best.colourway.name} vs. ${proof.contrast.colourway.name}`
              : "Scan your skin first"}
          </h2>
          {tone && proof && (
            <p className="mt-0.5 text-sm text-white/60">
              {proof.contrastIs === "as-pictured"
                ? `The photo sells it in ${proof.contrast.colourway.name}. For your ${tone.seasonLabel} palette we'd pick ${proof.best.colourway.name}.`
                : `${cap(proof.best.colourway.name)} is our pick for your ${tone.seasonLabel} palette; ${proof.contrast.colourway.name} is the colourway furthest from it.`}{" "}
              Same garment, same photo — only the colour changes.
            </p>
          )}
        </div>

        {!tone || !proof ? (
          <div className="p-8 text-center text-white/60">
            <p>
              Run a skin scan on the home page first — the proof needs your
              measured colour season.
            </p>
          </div>
        ) : (
          <div className="p-5">
            {/* Photo step */}
            {phase === "need-photo" && (
              <div className="mx-auto max-w-sm space-y-3 py-4 text-center">
                <p className="text-sm text-white/60">
                  Add a clear, front-facing photo (upper or full body).
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900"
                  >
                    <Upload className="h-4 w-4" /> Upload a photo
                  </button>
                </div>
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
                <p className="flex items-center justify-center gap-1 text-xs text-white/30">
                  <Camera className="h-3 w-3" /> Tip: bright, even light works best.
                </p>
              </div>
            )}

            {phase === "ready" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex items-center gap-4">
                  <Swatch color={proof.best.colourway.hex} label={proof.best.colourway.name} good />
                  <span className="text-white/30">vs</span>
                  <Swatch color={proof.contrast.colourway.hex} label={proof.contrast.colourway.name} />
                </div>
                <button
                  onClick={generate}
                  className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white/90"
                >
                  <Sparkles className="h-4 w-4" /> Generate the proof
                </button>
                <p className="text-xs text-white/40">
                  Runs two live try-ons on your photo · ~30–40s
                </p>
              </div>
            )}

            {phase === "running" && (
              <div className="flex flex-col items-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#d9a679]" />
                <p className="text-sm text-white/70">
                  Dressing you in both colours…
                </p>
              </div>
            )}

            {(phase === "done" || phase === "error") && (
              <div className="grid grid-cols-2 gap-3">
                <ProofSide
                  side={flat}
                  color={proof.best.colourway.hex}
                  title="Our pick for you"
                  subtitle={proof.best.reason}
                  good
                />
                <ProofSide
                  side={clash}
                  color={proof.contrast.colourway.hex}
                  title={contrastTitle}
                  subtitle={proof.contrast.reason}
                />
              </div>
            )}

            {note && <p className="mt-3 text-center text-xs text-amber-300/80">{note}</p>}

            {phase === "done" && (
              <p className="mt-3 text-center text-sm text-white/70">
                Same garment, same photo. Left is the colourway closest to your{" "}
                <span className="font-semibold text-white">{tone.seasonLabel}</span>{" "}
                palette; right is {proof.contrastIs === "as-pictured" ? "the colour in the product photo" : "the colourway furthest from it"}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Swatch({
  color,
  label,
  good,
}: {
  color: string;
  label: string;
  good?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="h-12 w-12 rounded-full border-2"
        style={{ background: color, borderColor: good ? "#34d399" : "#f59e0b" }}
      />
      <span className="text-[11px] capitalize text-white/60">{label}</span>
    </div>
  );
}

function ProofSide({
  side,
  color,
  title,
  subtitle,
  good,
}: {
  side: Side | null;
  color?: string;
  title: string;
  subtitle?: string;
  good?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-800">
      <div className="relative aspect-[3/4] max-h-[46dvh] overflow-hidden rounded-xl">
        {side ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={side.url} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-white/30">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        <span
          className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            good ? "bg-emerald-400/90 text-emerald-950" : "bg-amber-400/90 text-amber-950"
          }`}
        >
          {good ? <Check className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
          {title}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2 p-2.5">
        <span className="text-xs leading-snug text-white/60">{subtitle}</span>
        {color && (
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-white/20"
            style={{ background: color }}
          />
        )}
      </div>
    </div>
  );
}
