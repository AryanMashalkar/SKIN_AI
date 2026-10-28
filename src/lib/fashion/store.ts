"use client";

// Try-on session state only.
//
// The cart used to live here as a SECOND cart alongside the skincare one. It
// now lives in `@/lib/store` so the shopper has a single bag across the whole
// store; this file is deliberately limited to virtual try-on session state,
// none of which should outlive the session.

import { create } from "zustand";

export interface UserPhoto {
  dataUrl: string; // full-res data URL sent to the server
  previewUrl: string; // smaller preview for the UI
}

export type TryOnStatus = "idle" | "running" | "done" | "error";

/** Try-on results are per garment *and* colourway: navy on you is not khaki on you. */
export function resultKey(garmentId: string, colourwayId: string): string {
  return `${garmentId}:${colourwayId}`;
}

interface FashionState {
  userPhoto: UserPhoto | null;
  results: Record<string, string>; // resultKey -> result image URL
  status: Record<string, TryOnStatus>; // resultKey -> status
  /** garmentId -> colourway the shopper picked; unset means "our pick". */
  selected: Record<string, string>;

  tryOnFor: string | null; // garment id whose modal is open
  proofOpen: boolean;

  setUserPhoto: (p: UserPhoto | null) => void;
  setResult: (key: string, url: string) => void;
  setStatus: (key: string, s: TryOnStatus) => void;
  selectColourway: (garmentId: string, colourwayId: string) => void;

  openTryOn: (garmentId: string) => void;
  closeTryOn: () => void;
  openProof: () => void;
  closeProof: () => void;
}

// Not persisted at all. The body photo must not survive the session (privacy),
// and try-on results are tied to a photo that will not be there after reload.
export const useFashion = create<FashionState>()((set) => ({
  userPhoto: null,
  results: {},
  status: {},
  selected: {},
  tryOnFor: null,
  proofOpen: false,

  setUserPhoto: (p) => set({ userPhoto: p }),
  setResult: (key, url) =>
    set((s) => ({ results: { ...s.results, [key]: url } })),
  setStatus: (key, st) =>
    set((s) => ({ status: { ...s.status, [key]: st } })),
  selectColourway: (garmentId, colourwayId) =>
    set((s) => ({ selected: { ...s.selected, [garmentId]: colourwayId } })),

  openTryOn: (garmentId) => set({ tryOnFor: garmentId }),
  closeTryOn: () => set({ tryOnFor: null }),
  openProof: () => set({ proofOpen: true }),
  closeProof: () => set({ proofOpen: false }),
}));