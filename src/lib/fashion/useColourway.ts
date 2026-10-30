"use client";

// One source of truth for "which colour of this garment", shared by the card,
// the try-on modal and the proof shot, so they never disagree.
//
// Until the shopper picks a colour themselves, the selection is our pick: the
// best-ranked colourway for their scan, or the photographed original when
// there is no measured tone to rank against.

import { useEffect, useMemo, useState } from "react";
import type { Garment } from "@/lib/fashion/products";
import type { Colourway, RankedColourway } from "@/lib/fashion/colourways";
import { rankColourwaysForSkin } from "@/lib/fashion/styling";
import { recolorGarment } from "@/lib/fashion/recolor";
import { useFashion } from "@/lib/fashion/store";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

export interface ColourwayState {
  /** Best first. Empty without a measured tone. */
  ranking: RankedColourway[];
  colourway: Colourway;
  /** The selected colourway's verdict, when there is a ranking. */
  verdict: RankedColourway | null;
  /** Image to show for the selected colourway; null while it is rendering. */
  image: string | null;
  /** True when the selection is ours rather than the shopper's. */
  isOurPick: boolean;
  select: (colourwayId: string) => void;
}

export function useColourway(garment: Garment): ColourwayState {
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const skin = hydrated ? profile : null;
  const picked = useFashion((s) => s.selected[garment.id]);
  const selectColourway = useFashion((s) => s.selectColourway);

  const ranking = useMemo(
    () => (skin ? rankColourwaysForSkin(skin, garment) : []),
    [skin, garment],
  );

  const colourway =
    garment.colourways.find((c) => c.id === picked) ??
    ranking[0]?.colourway ??
    garment.colourways[0];

  return {
    ranking,
    colourway,
    verdict: ranking.find((r) => r.colourway.id === colourway.id) ?? null,
    image: useRecoloured(garment.image, colourway),
    isOurPick: !picked,
    select: (id) => selectColourway(garment.id, id),
  };
}

/** The garment photo in a colourway: the photo itself, or a cached recolour. */
export function useRecoloured(src: string, colourway: Colourway): string | null {
  const key = `${src}|${colourway.hex}`;
  const [rendered, setRendered] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (colourway.original) return;
    let live = true;
    recolorGarment(src, colourway.hex)
      .then((url) => {
        if (live) setRendered({ key, url });
      })
      .catch(() => {
        // Leave the original photo showing; the swatch still names the colour.
      });
    return () => {
      live = false;
    };
  }, [key, src, colourway.hex, colourway.original]);

  if (colourway.original) return src;
  return rendered?.key === key ? rendered.url : null;
}
