import type { RoastResult } from "./roast.functions";

/**
 * Roasts live in sessionStorage only — they disappear when the tab closes and
 * resume content is never persisted server-side. Accounts would replace this.
 */
const KEY = "kcs.roasts.v1";

export type StoredRoast = RoastResult & { id: string; createdAt: number };

function isBrowser() {
  return typeof window !== "undefined";
}

export function readRoasts(): StoredRoast[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredRoast[]) : [];
  } catch {
    return [];
  }
}

export function saveRoast(result: RoastResult): StoredRoast {
  const entry: StoredRoast = {
    ...result,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  if (!isBrowser()) return entry;
  try {
    const next = [entry, ...readRoasts()].slice(0, 10);
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — the roast still renders for this view.
  }
  return entry;
}

export function clearRoasts() {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
