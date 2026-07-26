"use client";

import { TrendingUp, TrendingDown, Minus, RotateCcw, CalendarClock } from "lucide-react";
import {
  CONCERN_META,
  lastScannedLabel,
  daysUntilRescan,
  isRescanDue,
  meaningfulDeltas,
  RESCAN_AFTER_DAYS,
  type SkinProfile,
} from "@/lib/skin";
import { useStore } from "@/lib/store";

export function ProgressSection({
  profile,
  previous,
}: {
  profile: SkinProfile;
  previous: SkinProfile | null;
}) {
  const openScan = useStore((s) => s.openScan);

  const deltas = previous ? meaningfulDeltas(previous, profile) : [];
  const improved = deltas.filter((d) => d.delta > 0);
  const declined = deltas.filter((d) => d.delta < 0);
  const overallDelta = previous ? profile.overall - previous.overall : 0;
  const due = isRescanDue(profile);
  const daysLeft = daysUntilRescan(profile);

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl font-medium tracking-tight text-stone-900">
            Your progress
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Last scanned{" "}
            <span className="font-medium text-stone-700">
              {lastScannedLabel(profile)}
            </span>
            {previous && (
              <>
                {" "}· compared with your scan from {lastScannedLabel(previous)}
              </>
            )}
          </p>
        </div>
        <button
          onClick={openScan}
          className="flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <RotateCcw className="h-4 w-4" /> Rescan
        </button>
      </div>

      {/* Rescan cadence */}
      <div
        className={`mt-5 flex items-start gap-2.5 rounded-2xl p-4 text-sm ${
          due
            ? "bg-emerald-50 text-emerald-800"
            : "bg-stone-50 text-stone-600"
        }`}
      >
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        {due ? (
          <span>
            It&apos;s been {RESCAN_AFTER_DAYS}+ days — skin renews on about a
            four-week cycle, so a rescan now will show real change.
          </span>
        ) : (
          <span>
            Rescan in <span className="font-semibold">{daysLeft} days</span> to
            track change. Skin renews on roughly a four-week cycle, so scanning
            sooner mostly measures lighting, not progress.
          </span>
        )}
      </div>

      {/* Deltas */}
      {!previous ? (
        <p className="mt-5 text-sm text-stone-500">
          This is your first scan — it becomes your baseline. Come back after
          four weeks of your routine and we&apos;ll show exactly what moved.
        </p>
      ) : deltas.length === 0 ? (
        <p className="mt-5 text-sm text-stone-500">
          Nothing has moved meaningfully since your last scan. That&apos;s
          normal over short periods — consistency is what shifts these numbers.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm text-stone-500">Overall health</span>
            <DeltaPill value={overallDelta} />
            <span className="text-sm text-stone-400">
              {previous.overall} → <strong className="text-stone-700">{profile.overall}</strong>
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[...improved, ...declined].slice(0, 6).map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between rounded-xl border border-stone-200/70 bg-stone-50/50 px-3 py-2"
              >
                <span className="text-sm font-medium text-stone-700">
                  {CONCERN_META[d.key].label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">
                    {d.from} → {d.to}
                  </span>
                  <DeltaPill value={d.delta} />
                </span>
              </div>
            ))}
          </div>

          {improved.length > 0 && (
            <p className="mt-4 text-sm text-stone-600">
              <strong className="text-emerald-600">
                {improved.length} concern{improved.length > 1 ? "s" : ""} improved
              </strong>{" "}
              since your last scan — keep going.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DeltaPill({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {value}
    </span>
  );
}
