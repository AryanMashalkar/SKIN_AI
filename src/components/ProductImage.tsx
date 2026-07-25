"use client";

// Owned, procedural product imagery — a cohesive SVG "bottle" per category,
// tinted with each product's accent gradient. No stock photos, no licensing
// risk, and it scales crisply. Replaces the emoji tiles.

import type { Category, Product } from "@/lib/products";

export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const [from, to] = product.accent;
  const id = product.id;

  return (
    <svg
      viewBox="0 0 120 140"
      className={className}
      role="img"
      aria-label={`${product.name} bottle`}
    >
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Bottle category={product.category} id={id} />
      {/* soft ground shadow */}
      <ellipse cx="60" cy="132" rx="26" ry="4" fill="#000" opacity="0.06" />
    </svg>
  );
}

function Bottle({ category, id }: { category: Category; id: string }) {
  const body = `url(#body-${id})`;
  const glass = `url(#glass-${id})`;
  const cap = "#2b2b31";

  // A translucent label with a couple of hint-lines, shared across shapes.
  const Label = ({ y = 66, h = 34 }: { y?: number; h?: number }) => (
    <g>
      <rect x="40" y={y} width="40" height={h} rx="4" fill="#fff" opacity="0.9" />
      <rect x="46" y={y + 8} width="28" height="3" rx="1.5" fill={body} opacity="0.55" />
      <rect x="46" y={y + 15} width="20" height="2.5" rx="1.25" fill="#9ca3af" />
      <rect x="46" y={y + 21} width="24" height="2.5" rx="1.25" fill="#d1d5db" />
    </g>
  );

  switch (category) {
    case "Serum":
    case "Eye Care": {
      // slim dropper bottle
      const narrow = category === "Eye Care";
      const x = narrow ? 46 : 42;
      const w = narrow ? 28 : 36;
      return (
        <g>
          {/* dropper bulb + pipette cap */}
          <rect x="54" y="6" width="12" height="14" rx="3" fill={cap} />
          <rect x="50" y="18" width="20" height="8" rx="3" fill={cap} />
          <rect x={x} y="24" width={w} height="102" rx="12" fill={body} />
          <rect x={x} y="24" width={w * 0.4} height="102" rx="12" fill={glass} />
          <Label y={62} h={40} />
        </g>
      );
    }
    case "Moisturizer": {
      // wide jar with lid
      return (
        <g>
          <rect x="30" y="30" width="60" height="14" rx="5" fill={cap} />
          <rect x="26" y="42" width="68" height="82" rx="14" fill={body} />
          <rect x="26" y="42" width="26" height="82" rx="14" fill={glass} />
          <Label y={64} h={38} />
        </g>
      );
    }
    case "Cleanser": {
      // pump bottle
      return (
        <g>
          <rect x="56" y="4" width="8" height="16" rx="2" fill={cap} />
          <rect x="48" y="16" width="24" height="7" rx="3" fill={cap} />
          <rect x="52" y="22" width="16" height="8" fill={cap} />
          <rect x="38" y="30" width="44" height="96" rx="12" fill={body} />
          <rect x="38" y="30" width="18" height="96" rx="12" fill={glass} />
          <Label y={62} h={44} />
        </g>
      );
    }
    case "SPF": {
      // squeeze tube
      return (
        <g>
          <rect x="50" y="8" width="20" height="12" rx="3" fill={cap} />
          <path
            d="M44 22 h32 l-4 100 a6 6 0 0 1 -6 5 h-6 a6 6 0 0 1 -6 -5 z"
            fill={body}
          />
          <path d="M44 22 h12 l-2 105 h-6 a6 6 0 0 1 -6 -5 z" fill={glass} />
          <Label y={54} h={40} />
        </g>
      );
    }
    case "Treatment":
    default: {
      // classic dropper serum, slightly broader
      return (
        <g>
          <rect x="52" y="4" width="16" height="16" rx="3" fill={cap} />
          <rect x="48" y="18" width="24" height="8" rx="3" fill={cap} />
          <rect x="40" y="24" width="40" height="102" rx="13" fill={body} />
          <rect x="40" y="24" width="16" height="102" rx="13" fill={glass} />
          <Label y={62} h={42} />
        </g>
      );
    }
  }
}
