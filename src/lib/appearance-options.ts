"use client";

// Hair and eye colour options for the scan flow.
//
// These are user-selected rather than computer-vision-extracted, deliberately:
// hair segmentation against a similar-toned background and iris colour under
// screen glare are both unreliable, and a wrong automatic reading is worse than
// a correct manual one. Trained colour analysts ask these questions directly
// too. Automatic sampling can later pre-select an option here rather than
// replace it.
//
// Hex values are representative pigment centroids, chosen so their CIELAB b*
// (the yellow-blue axis) reflects real warm/cool pigment behaviour: ash and
// blue tones sit at low or negative b*, golden and copper tones high positive.

export interface ColorOption {
  id: string;
  label: string;
  hex: string;
}

export const HAIR_OPTIONS: ColorOption[] = [
  { id: "black", label: "Black", hex: "#1c1614" },
  { id: "dark-brown", label: "Dark brown", hex: "#3b2a1e" },
  { id: "medium-brown", label: "Medium brown", hex: "#6b4a30" },
  { id: "ash-brown", label: "Ash brown", hex: "#6b5a4e" },
  { id: "auburn", label: "Auburn / red", hex: "#8a4b23" },
  { id: "copper", label: "Copper / ginger", hex: "#a5502a" },
  { id: "golden-blonde", label: "Golden blonde", hex: "#d9b26a" },
  { id: "ash-blonde", label: "Ash blonde", hex: "#cfc0a8" },
  { id: "platinum", label: "Platinum / white", hex: "#e8ddc9" },
  { id: "grey", label: "Grey / silver", hex: "#9a9691" },
];

export const EYE_OPTIONS: ColorOption[] = [
  { id: "dark-brown", label: "Dark brown", hex: "#2b1f1a" },
  { id: "medium-brown", label: "Medium brown", hex: "#5a3a22" },
  { id: "amber", label: "Amber / honey", hex: "#8a5a2b" },
  { id: "hazel", label: "Hazel", hex: "#8a7f56" },
  { id: "green", label: "Green", hex: "#7a8f5a" },
  { id: "blue", label: "Blue", hex: "#6a9ec4" },
  { id: "pale-blue", label: "Pale blue", hex: "#a8c4d4" },
  { id: "grey", label: "Grey", hex: "#8a8f8c" },
];
