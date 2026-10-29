"use client";

import { useState } from "react";
import { Wand2, Loader2, Sparkles, ChevronDown, Check, AlertTriangle, Bot, ListChecks } from "lucide-react";
import { useStore } from "@/lib/store";
import { useFashion } from "@/lib/fashion/store";
import { garmentById } from "@/lib/fashion/products";
import { useRecoloured } from "@/lib/fashion/useColourway";
import type { Look, LookItem } from "@/lib/agent/tools";
import { readJson } from "@/lib/http";

const EXAMPLES = [
  "Smart-casual brunch on Sunday, under $130",
  "Weekend hiking trip, I run warm",
  "Dinner date Saturday night",
];

type Phase = "idle" | "running" | "done" | "error";

/**
 * Occasion in, look out. The stylist (Grok, or the rules planner without a
 * key) picks pieces and colourways through measured tools; the card shows the
 * measured fit and reason for each, plus the steps it took.
 */
export function OccasionStylist() {
  const profile = useStore((s) => s.profile);
  const [brief, setBrief] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [look, setLook] = useState<Look | null>(null);
  const [error, setError] = useState("");

  async function run(text: string) {
    const b = text.trim();
    if (!b || !profile) return;
    setBrief(b);
    setPhase("running");
    setError("");
    setLook(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: b, profile }),
      });
      const { data, message } = await readJson<{ look: Look | null; error?: string }>(res);
      if (data?.look) {
        setLook(data.look);
        setPhase("done");
      } else {
        setError(data?.error || message || "The stylist couldn't build a look for that.");
        setPhase("error");
      }
    } catch {
      setError("Couldn't reach the stylist. Try again.");
      setPhase("error");
    }
  }

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#e9d9be]/85">
        <Wand2 className="h-4 w-4" /> Occasion stylist
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
        Tell it where you&apos;re going. It dresses you in your colours.
      </h2>
      <p className="mt-1 text-sm text-white/50">
        It plans with your measured season and today&apos;s scan. Every fit score
        it shows is measured, not written by the AI.
      </p>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(brief);
        }}
      >
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          maxLength={400}
          placeholder="e.g. Smart-casual brunch on Sunday, under $130"
          aria-label="Describe the occasion"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/30 px-5 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!brief.trim() || phase === "running"}
          className="flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white/90 disabled:opacity-40"
        >
          {phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {phase === "running" ? "Styling…" : "Style me"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => run(ex)}
            disabled={phase === "running"}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55 transition hover:border-white/30 hover:text-white/80 disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>

      {phase === "running" && (
        <p className="mt-5 text-sm text-white/50">
          Reading your scan, searching the collection and ranking colours…
        </p>
      )}
      {phase === "error" && <p className="mt-5 text-sm text-amber-300/80">{error}</p>}
      {phase === "done" && look && <LookCard look={look} />}
    </div>
  );
}

function LookCard({ look }: { look: Look }) {
  const [showTrace, setShowTrace] = useState(false);
  const overBudget = look.budget !== null && look.total > look.budget;

  return (
    <div className="mt-6 animate-float-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              look.source === "grok"
                ? "bg-[#d9a679]/20 text-[#e9d9be]"
                : "bg-white/10 text-white/60"
            }`}
          >
            {look.source === "grok" ? <Bot className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
            {look.source === "grok" ? "Planned by Grok with measured tools" : "Planned by rules"}
          </span>
          <h3 className="mt-2 text-lg font-semibold">{look.headline}</h3>
          {look.note && <p className="mt-1 max-w-2xl text-sm text-white/60">{look.note}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">${look.total}</p>
          <p className={`text-xs ${overBudget ? "text-amber-300/80" : "text-white/40"}`}>
            {look.budget !== null ? `of $${look.budget} budget` : "no budget set"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {look.items.map((item) => (
          <LookPiece key={item.garmentId} item={item} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowTrace((v) => !v)}
        className="mt-4 flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white/80"
        aria-expanded={showTrace}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition ${showTrace ? "rotate-180" : ""}`} />
        How it decided ({look.trace.length} steps)
      </button>
      {showTrace && (
        <ol className="mt-2 space-y-1 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs">
          {look.trace.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-4 shrink-0 text-right text-white/30">{i + 1}</span>
              <code className="shrink-0 text-[#e9d9be]/80">{step.tool}</code>
              <span className="text-white/55">{step.summary}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LookPiece({ item }: { item: LookItem }) {
  const garment = garmentById(item.garmentId);
  const selectColourway = useFashion((s) => s.selectColourway);
  const openTryOn = useFashion((s) => s.openTryOn);
  const colourway = garment?.colourways.find((c) => c.id === item.colourwayId);
  const image = useRecoloured(garment?.image ?? "", colourway ?? { id: "", name: "", hex: "#000", original: true });
  if (!garment || !colourway) return null;

  const good = item.verdict === "best" || item.verdict === "good";

  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
      <div
        className="h-28 w-20 shrink-0 overflow-hidden rounded-xl"
        style={{ background: `linear-gradient(160deg, ${garment.accent[0]}, ${garment.accent[1]})` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image || garment.image}
          alt={`${garment.name} in ${colourway.name}`}
          className={`h-full w-full object-cover ${image ? "" : "opacity-40"}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{garment.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs capitalize text-white/60">
          <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: colourway.hex }} />
          {colourway.name} · ${item.price}
        </p>
        <p className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${good ? "text-emerald-300/75" : "text-white/50"}`}>
          {good ? <Check className="mt-0.5 h-3 w-3 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />}
          <span>{item.reason}</span>
        </p>
        {item.why && <p className="mt-1 text-[11px] italic leading-snug text-white/45">“{item.why}”</p>}
        <button
          type="button"
          onClick={() => {
            selectColourway(garment.id, colourway.id);
            openTryOn(garment.id);
          }}
          className="mt-2 flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10"
        >
          <Sparkles className="h-3 w-3" /> See it on you
        </button>
      </div>
    </div>
  );
}
