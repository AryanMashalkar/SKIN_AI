"use client";

import { severityFor, SEVERITY_META } from "@/lib/skin";

interface Props {
  score: number;
  label: string;
  size?: number;
  delay?: number;
}

/** Circular progress gauge. Score 0-100 where higher = healthier. */
export function ConcernGauge({ score, label, size = 92, delay = 0 }: Props) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const sev = severityFor(score);
  const color = SEVERITY_META[sev].ring;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f0efed"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            style={{
              strokeDashoffset: offset,
              transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)",
              transitionDelay: `${delay}ms`,
            }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-lg font-semibold text-stone-900">{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-stone-600">{label}</span>
    </div>
  );
}
