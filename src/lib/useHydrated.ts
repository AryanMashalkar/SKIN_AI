"use client";

import { useEffect, useState } from "react";

/** Returns true only after the first client-side mount, to safely gate
 *  rendering of persisted (localStorage) state and avoid hydration mismatch. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
