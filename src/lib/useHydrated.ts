"use client";

import { useSyncExternalStore } from "react";

// `useSyncExternalStore` with a constant server snapshot is the canonical
// hydration-safe pattern in React 18+. The previous implementation used
// `useEffect(() => setHydrated(true), [])`, which triggers a second render
// pass on every mount of every component that calls it.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/** Returns true only after the first client-side mount, to safely gate
 *  rendering of persisted (localStorage) state and avoid hydration mismatch. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
