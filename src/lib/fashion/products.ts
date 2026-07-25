// Apparel catalog for the standalone fashion store. Each garment maps to a
// Perfect Corp AI Clothes VTO `garment_category` so the try-on request is built
// correctly. Images live in /public/garments (clean product shots) and are
// served publicly via the dev tunnel so Perfect Corp can fetch them as
// `ref_file_url`.

export type GarmentCategory = "upper_body" | "lower_body" | "full_body";

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
  swatch: string; // hex of the garment's main colour
  colorName: string; // human colour label, e.g. "slate blue"
  warmth: ColorWarmth;
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
    swatch: "#3f4a5a",
    colorName: "slate blue",
    warmth: "cool",
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
    swatch: "#4b3f3a",
    colorName: "warm espresso",
    warmth: "warm",
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
    swatch: "#1f3a5f",
    colorName: "deep ocean blue",
    warmth: "cool",
  },
  {
    id: "slim-tee",
    name: "Premium Slim-Fit Tee",
    brand: "Basics Co.",
    price: 24,
    category: "Tops",
    garmentCategory: "upper_body",
    image: "/garments/slim-tee.jpg",
    description: "A wardrobe staple: heavyweight cotton with a clean slim cut.",
    details: ["Cotton", "Slim fit", "Ribbed collar"],
    sizes: ["XS", "S", "M", "L", "XL"],
    accent: ["#5a6270", "#2f353f"],
    swatch: "#5a6270",
    colorName: "cool grey",
    warmth: "neutral",
  },
  {
    id: "slim-fit-tee",
    name: "Casual Slim Henley",
    brand: "Basics Co.",
    price: 18,
    category: "Tops",
    garmentCategory: "upper_body",
    image: "/garments/slim-fit-tee.jpg",
    description: "An everyday short-sleeve in a flattering slim silhouette.",
    details: ["Cotton blend", "Slim fit", "Short sleeve"],
    sizes: ["S", "M", "L", "XL"],
    accent: ["#6b3f3f", "#331d1d"],
    swatch: "#6b3f3f",
    colorName: "warm brick",
    warmth: "warm",
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
    swatch: "#2f5d54",
    colorName: "cool teal",
    warmth: "cool",
    tag: "Limited",
  },
];

export const GARMENT_CATEGORIES = ["All", "Outerwear", "Tops"] as const;

export function garmentById(id: string): Garment | undefined {
  return GARMENTS.find((g) => g.id === id);
}
