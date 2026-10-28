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
  tag?: string;
}

export const GARMENTS: Garment[] = [
  {
    id: "cotton-jacket",
    name: "Field Cotton Jacket",
    brand: "Atelier Nord",
    price: 96,
    category: "Outerwear",
    garmentCategory: "upper_body",
    image: "/garments/cotton-jacket.jpg",
    description:
      "A rugged cotton utility jacket with a soft lining and a boxy fit.",
    details: ["100% cotton", "Full zip", "Multiple pockets"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#3f4a5a", "#20272f"],
    swatch: "#ad947c",
    colorName: "khaki",
    warmth: "warm",
    colourways: [
      { id: "khaki", name: "khaki", hex: "#ad947c", original: true },
      { id: "olive", name: "olive", hex: "#6b6b3a" },
      { id: "navy", name: "navy", hex: "#26304d" },
      { id: "rust", name: "rust", hex: "#94452a" },
      { id: "stone", name: "stone grey", hex: "#8c8c88" },
    ],
    tag: "Bestseller",
  },
  {
    id: "leather-jacket",
    name: "Hooded Faux-Leather Jacket",
    brand: "Maison Lila",
    price: 78,
    category: "Outerwear",
    garmentCategory: "upper_body",
    image: "/garments/leather-jacket.jpg",
    description:
      "A removable-hood moto jacket in supple faux leather. Effortless edge.",
    details: ["Faux leather", "Removable hood", "Zip cuffs"],
    sizes: ["XS", "S", "M", "L"],
    accent: ["#4b3f3a", "#241c19"],
    swatch: "#323234",
    colorName: "black",
    warmth: "neutral",
    colourways: [{ id: "black", name: "black", hex: "#323234", original: true }],
    tag: "New",
  },
  {
    id: "snowboard-jacket",
    name: "3-in-1 Snowboard Jacket",
    brand: "Summit Supply",
    price: 149,
    category: "Outerwear",
    garmentCategory: "upper_body",
    image: "/garments/snowboard-jacket.jpg",
    description:
      "A waterproof 3-in-1 shell with a zip-out liner for any conditions.",
    details: ["Waterproof shell", "Zip-out liner", "Sealed seams"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#1f3a5f", "#0f1f36"],
    swatch: "#33194c",
    colorName: "deep purple",
    warmth: "cool",
    colourways: [
      { id: "purple", name: "deep purple", hex: "#33194c", original: true },
      { id: "forest", name: "forest green", hex: "#2f5136" },
      { id: "burgundy", name: "burgundy", hex: "#6a2333" },
      { id: "navy", name: "navy", hex: "#1f2a4a" },
      { id: "teal", name: "deep teal", hex: "#1f5a5a" },
    ],
  },
  {
    id: "slim-tee",
    name: "Raglan Henley",
    brand: "Basics Co.",
    price: 24,
    category: "Tops",
    garmentCategory: "upper_body",
    image: "/garments/slim-tee.jpg",
    description: "A heather-body henley with contrast raglan sleeves.",
    details: ["Cotton blend", "Raglan sleeves", "Three-button placket"],
    sizes: ["XS", "S", "M", "L", "XL"],
    accent: ["#5a6270", "#2f353f"],
    swatch: "#c6c6c6",
    colorName: "heather grey",
    warmth: "neutral",
    colourways: [
      { id: "grey", name: "heather grey", hex: "#c6c6c6", original: true },
      { id: "oatmeal", name: "oatmeal", hex: "#d9ccb4" },
      { id: "sage", name: "sage", hex: "#a9b8a0" },
      { id: "dusty-blue", name: "dusty blue", hex: "#a6b4cc" },
      { id: "blush", name: "blush", hex: "#e2b9b4" },
    ],
  },
  {
    id: "slim-fit-tee",
    name: "Long-Sleeve V-Neck Tee",
    brand: "Basics Co.",
    price: 18,
    category: "Tops",
    garmentCategory: "upper_body",
    image: "/garments/slim-fit-tee.jpg",
    description: "An everyday long-sleeve V-neck in a flattering slim silhouette.",
    details: ["Cotton", "Slim fit", "Long sleeve"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#6b3f3f", "#331d1d"],
    swatch: "#4d5874",
    colorName: "heather blue",
    warmth: "cool",
    colourways: [
      { id: "blue", name: "heather blue", hex: "#4d5874", original: true },
      { id: "brick", name: "brick", hex: "#8a3a2a" },
      { id: "forest", name: "forest green", hex: "#2f5136" },
      { id: "mustard", name: "mustard", hex: "#b8892e" },
      { id: "charcoal", name: "charcoal", hex: "#3a3a3c" },
    ],
  },
  {
    id: "boat-neck-top",
    name: "Boat-Neck Short Sleeve Top",
    brand: "Maison Lila",
    price: 22,
    category: "Tops",
    garmentCategory: "upper_body",
    image: "/garments/boat-neck-top.jpg",
    description: "A soft, drapey boat-neck top that layers with everything.",
    details: ["Viscose blend", "Boat neck", "Relaxed fit"],
    sizes: ["XS", "S", "M", "L"],
    accent: ["#3a4a4a", "#1c2626"],
    swatch: "#eeeeee",
    colorName: "white",
    warmth: "neutral",
    colourways: [{ id: "white", name: "white", hex: "#eeeeee", original: true }],
    tag: "Limited",
  },
];

export const GARMENT_CATEGORIES = ["All", "Outerwear", "Tops"] as const;

export function garmentById(id: string): Garment | undefined {
  return GARMENTS.find((g) => g.id === id);
}
