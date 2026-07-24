import type { ConcernKey } from "@/lib/skin";

export type Category =
  | "Serum"
  | "Moisturizer"
  | "Cleanser"
  | "Treatment"
  | "Eye Care"
  | "SPF";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  blurb: string;
  keyIngredients: string[];
  // Concerns this product is formulated to improve.
  concerns: ConcernKey[];
  // Two-stop gradient for the product tile (from, to).
  accent: [string, string];
  emoji: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "hydra-serum",
    name: "Hydra-Plump HA Serum",
    brand: "Lumé Labs",
    category: "Serum",
    price: 32,
    blurb: "Triple-weight hyaluronic acid that floods parched skin with lasting moisture.",
    keyIngredients: ["Hyaluronic Acid", "Glycerin", "Vitamin B5"],
    concerns: ["moisture", "texture"],
    accent: ["#38bdf8", "#0ea5e9"],
    emoji: "💧",
  },
  {
    id: "niacin-balance",
    name: "Balance 10% Niacinamide",
    brand: "Lumé Labs",
    category: "Serum",
    price: 24,
    blurb: "Regulates oil, tightens the look of pores and calms angry, congested skin.",
    keyIngredients: ["Niacinamide", "Zinc PCA"],
    concerns: ["oiliness", "pore", "redness"],
    accent: ["#fbbf24", "#f59e0b"],
    emoji: "⚖️",
  },
  {
    id: "bha-clarify",
    name: "Clarify 2% BHA Exfoliant",
    brand: "Ordinary Rituals",
    category: "Treatment",
    price: 28,
    blurb: "Salicylic acid dives into pores to clear congestion and prevent breakouts.",
    keyIngredients: ["Salicylic Acid", "Green Tea"],
    concerns: ["acne", "pore", "oiliness"],
    accent: ["#fb7185", "#e11d48"],
    emoji: "🧪",
  },
  {
    id: "retinol-renew",
    name: "Renew 0.3% Retinol Night",
    brand: "Nocturne",
    category: "Treatment",
    price: 46,
    blurb: "Encapsulated retinol smooths fine lines and refines texture while you sleep.",
    keyIngredients: ["Retinol", "Peptides", "Squalane"],
    concerns: ["wrinkle", "texture", "firmness"],
    accent: ["#818cf8", "#4f46e5"],
    emoji: "🌙",
  },
  {
    id: "vitc-glow",
    name: "Glow 15% Vitamin C",
    brand: "Solstice",
    category: "Serum",
    price: 38,
    blurb: "Stabilized L-ascorbic acid brightens dullness and fades dark spots over time.",
    keyIngredients: ["Vitamin C", "Ferulic Acid", "Vitamin E"],
    concerns: ["radiance", "age_spot", "firmness"],
    accent: ["#fde047", "#f59e0b"],
    emoji: "☀️",
  },
  {
    id: "cica-calm",
    name: "Cica Calm Recovery Cream",
    brand: "Baré",
    category: "Moisturizer",
    price: 30,
    blurb: "Centella-rich barrier cream that soothes redness and reactive, sensitive skin.",
    keyIngredients: ["Centella Asiatica", "Ceramides", "Allantoin"],
    concerns: ["redness", "moisture"],
    accent: ["#4ade80", "#16a34a"],
    emoji: "🌿",
  },
  {
    id: "ceramide-barrier",
    name: "Barrier+ Ceramide Moisturizer",
    brand: "Baré",
    category: "Moisturizer",
    price: 34,
    blurb: "Ceramide and squalane blend that rebuilds a soft, resilient moisture barrier.",
    keyIngredients: ["Ceramides", "Squalane", "Glycerin"],
    concerns: ["moisture", "texture", "redness"],
    accent: ["#22d3ee", "#0891b2"],
    emoji: "🛡️",
  },
  {
    id: "gentle-gel",
    name: "Gentle Gel Cleanser",
    brand: "Ordinary Rituals",
    category: "Cleanser",
    price: 18,
    blurb: "A pH-balanced gel that lifts oil and grime without stripping the barrier.",
    keyIngredients: ["Glycerin", "Panthenol"],
    concerns: ["oiliness", "redness"],
    accent: ["#5eead4", "#14b8a6"],
    emoji: "🫧",
  },
  {
    id: "peptide-eye",
    name: "Awake Peptide Eye Serum",
    brand: "Nocturne",
    category: "Eye Care",
    price: 29,
    blurb: "Caffeine and peptides de-puff and visibly lift stubborn under-eye shadows.",
    keyIngredients: ["Caffeine", "Peptides", "Vitamin K"],
    concerns: ["dark_circle", "firmness"],
    accent: ["#c084fc", "#9333ea"],
    emoji: "👁️",
  },
  {
    id: "aha-resurface",
    name: "Resurface 8% AHA Toner",
    brand: "Solstice",
    category: "Treatment",
    price: 26,
    blurb: "Glycolic + lactic acids sweep away dead cells for smoother, brighter skin.",
    keyIngredients: ["Glycolic Acid", "Lactic Acid", "PHA"],
    concerns: ["texture", "radiance", "pore"],
    accent: ["#fca5a5", "#f97316"],
    emoji: "✨",
  },
  {
    id: "arbutin-fade",
    name: "Even Alpha Arbutin Fade",
    brand: "Solstice",
    category: "Serum",
    price: 27,
    blurb: "Targets hyperpigmentation and post-blemish marks for a more even tone.",
    keyIngredients: ["Alpha Arbutin", "Tranexamic Acid", "Niacinamide"],
    concerns: ["age_spot", "radiance"],
    accent: ["#f0abfc", "#c026d3"],
    emoji: "🎯",
  },
  {
    id: "mineral-spf",
    name: "Daily Mineral SPF 50",
    brand: "Solstice",
    category: "SPF",
    price: 33,
    blurb: "Weightless mineral shield that prevents new spots, lines and firmness loss.",
    keyIngredients: ["Zinc Oxide", "Niacinamide", "Vitamin E"],
    concerns: ["age_spot", "wrinkle", "firmness"],
    accent: ["#fdba74", "#fb923c"],
    emoji: "🧴",
  },
];

export const CATEGORIES: Category[] = [
  "Serum",
  "Moisturizer",
  "Treatment",
  "Cleanser",
  "Eye Care",
  "SPF",
];
