// Apparel catalog for the standalone fashion store. Each garment maps to a
// Perfect Corp AI Clothes VTO `garment_category` so the try-on request is built
// correctly. Images live in /public/garments (clean product shots) and are
// served publicly via the dev tunnel so Perfect Corp can fetch them as
// `ref_file_url`.

export type GarmentCategory = "upper_body" | "lower_body" | "full_body";

import type { Colourway } from "@/lib/fashion/colourways";

// Color temperature of the garment's dominant fabric colour. Used by the
// skin-informed styling engine to match garments to a complexion (cool tones
// calm visible redness; warm tones can amplify it).
export type ColorWarmth = "cool" | "warm" | "neutral";

/** Where a garment can be worn. The occasion agent filters on these. */
export const OCCASIONS = ["everyday", "smart-casual", "evening", "outdoor", "travel"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export interface Garment {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string; // display label
  garmentCategory: GarmentCategory; // Perfect Corp VTO param
  image: string; // public path, e.g. /garments/cotton-jacket.jpg
  description: string;
  details: string[];
  sizes: string[];
  accent: [string, string];
  // Dominant fabric colour + its temperature, for skin-informed styling.
  // `swatch` is measured from the product photo (median fabric pixel, see the
  // catalogue-integrity tests), not picked by eye.
  swatch: string; // hex of the garment's main colour
  colorName: string; // human colour label, e.g. "khaki"
  warmth: ColorWarmth;
  /**
   * Colours this garment is sold in. The first is the photographed original;
   * the rest are rendered by recolouring the photo (lib/fashion/recolor.ts).
   * Very dark and near-white fabrics only list their original, because
   * recolouring them cannot preserve believable shading.
   */
  colourways: Colourway[];
  occasions: Occasion[];
  tag?: string;
}

export const GARMENTS: Garment[] = [
  {
    id: "field-overshirt",
    name: "Washed Field Overshirt",
    brand: "Atelier Nord",
    price: 96,
    category: "Outerwear",
    garmentCategory: "upper_body",
    image: "/garments/field-overshirt.jpg",
    description: "A washed snap-front overshirt with twin chest pockets. Layers over anything.",
    details: ["Stretch twill", "Snap front", "Twin chest pockets"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#4a4745", "#262423"],
    swatch: "#716f6e",
    colorName: "washed taupe",
    warmth: "neutral",
    colourways: [
      { id: "taupe", name: "washed taupe", hex: "#716f6e", original: true },
      { id: "navy", name: "navy", hex: "#26304d" },
      { id: "olive", name: "olive", hex: "#6b6b3a" },
      { id: "rust", name: "rust", hex: "#94452a" },
      { id: "forest", name: "forest green", hex: "#2f5136" },
    ],
    occasions: ["smart-casual", "outdoor", "everyday", "travel"],
    tag: "Bestseller",
  },
  {
    id: "crew-tee",
    name: "Everyday Crew Tee",
    brand: "Basics Co.",
    price: 18,
    category: "Tops",
    garmentCategory: "upper_body",
    image: "/garments/crew-tee.jpg",
    description: "A soft cotton crew-neck tee with a relaxed, easy fit.",
    details: ["Cotton", "Crew neck", "Short sleeve"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#6b3f3f", "#331d1d"],
    swatch: "#742b37",
    colorName: "burgundy",
    warmth: "neutral",
    colourways: [
      { id: "burgundy", name: "burgundy", hex: "#742b37", original: true },
      { id: "brick", name: "brick", hex: "#8a3a2a" },
      { id: "forest", name: "forest green", hex: "#2f5136" },
      { id: "mustard", name: "mustard", hex: "#b8892e" },
      { id: "sapphire", name: "sapphire", hex: "#2f4f7a" },
    ],
    occasions: ["everyday", "travel", "outdoor"],
  },
  {
    id: "pique-polo",
    name: "Pique Polo",
    brand: "Maison Lila",
    price: 32,
    category: "Tops",
    garmentCategory: "upper_body",
    image: "/garments/pique-polo.jpg",
    description: "A fine pique polo with a soft collar. Smart enough for most days out.",
    details: ["Cotton pique", "Three-button placket", "Ribbed cuffs"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#8a6a5f", "#4a3730"],
    swatch: "#cfa89b",
    colorName: "soft peach",
    warmth: "warm",
    colourways: [
      { id: "peach", name: "soft peach", hex: "#cfa89b", original: true },
      { id: "oatmeal", name: "oatmeal", hex: "#d9ccb4" },
      { id: "sage", name: "sage", hex: "#a9b8a0" },
      { id: "dusty-blue", name: "dusty blue", hex: "#a6b4cc" },
      { id: "stone", name: "stone grey", hex: "#b4b4b0" },
    ],
    occasions: ["smart-casual", "everyday", "evening"],
    tag: "New",
  },
  {
    id: "slate-joggers",
    name: "Tapered Joggers",
    brand: "Summit Supply",
    price: 44,
    category: "Bottoms",
    garmentCategory: "lower_body",
    image: "/garments/slate-joggers.jpg",
    description: "Light, stretchy tapered joggers with a contrast waistband.",
    details: ["Stretch woven", "Drawcord waist", "Tapered leg"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#3a4656", "#1c2430"],
    swatch: "#455268",
    colorName: "slate blue",
    warmth: "cool",
    colourways: [
      { id: "slate", name: "slate blue", hex: "#455268", original: true },
      { id: "charcoal", name: "charcoal", hex: "#3a3a3c" },
      { id: "olive", name: "olive", hex: "#5a5c38" },
    ],
    occasions: ["everyday", "travel", "outdoor"],
  },
  {
    id: "black-joggers",
    name: "Zip-Pocket Track Pants",
    brand: "Summit Supply",
    price: 48,
    category: "Bottoms",
    garmentCategory: "lower_body",
    image: "/garments/black-joggers.jpg",
    description: "Slim track pants with a zip pocket on the thigh.",
    details: ["Stretch woven", "Elastic waist", "Zip pocket"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#2a2a2a", "#111111"],
    swatch: "#171717",
    colorName: "black",
    warmth: "neutral",
    colourways: [{ id: "black", name: "black", hex: "#171717", original: true }],
    occasions: ["evening", "everyday", "smart-casual"],
  },
];

export const GARMENT_CATEGORIES = ["All", "Outerwear", "Tops", "Bottoms"] as const;

export function garmentById(id: string): Garment | undefined {
  return GARMENTS.find((g) => g.id === id);
}
