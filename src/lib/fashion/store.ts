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

interface FashionState {
  userPhoto: UserPhoto | null;
  results: Record<string, string>; // garmentId -> result image URL
  status: Record<string, TryOnStatus>;

  tryOnFor: string | null; // garment id whose modal is open
  proofOpen: boolean;

  setUserPhoto: (p: UserPhoto | null) => void;
  setResult: (garmentId: string, url: string) => void;
  setStatus: (garmentId: string, s: TryOnStatus) => void;

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
  tryOnFor: null,
  proofOpen: false,

  setUserPhoto: (p) => set({ userPhoto: p }),
  setResult: (garmentId, url) =>
    set((s) => ({ results: { ...s.results, [garmentId]: url } })),
  setStatus: (garmentId, st) =>
    set((s) => ({ status: { ...s.status, [garmentId]: st } })),

  openTryOn: (garmentId) => set({ tryOnFor: garmentId }),
  closeTryOn: () => set({ tryOnFor: null }),
  openProof: () => set({ proofOpen: true }),
  closeProof: () => set({ proofOpen: false }),
}));