import type { RoastResult } from "./roast.functions";
import { isLetterGrade } from "./roast-grounding";
import { DeliveredRoastSchema } from "./roast-delivery";

/**
 * Free roasts live in this tab. A signed copy may be attached explicitly at checkout
 * and then remains part of that private order's immutable server snapshot.
 */
const KEY = "kcs.roasts.v2";
const ACTIVE_KEY = "kcs.active-roast.v1";
// Older entries with any grade outside A/B/C/D/F (e.g. plus/minus) are dropped on read.

export type GradedRoast = Extract<RoastResult, { status: "graded" }>;
export type StoredRoast = GradedRoast & { id: string; createdAt: number };

function isBrowser() {
  return typeof window !== "undefined";
}

export function readRoasts(): StoredRoast[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as StoredRoast[]).filter((r) => {
          if (!r || r.status !== "graded" || !isLetterGrade(r.grade) || !Array.isArray(r.notes)) return false;
          if (!r.persona && !r.personality) return true; // Legacy results keep their original display.
          return DeliveredRoastSchema.safeParse({ grade: r.grade, persona: r.persona, personality: r.personality, notes: r.notes, label: r.label }).success
            && (r.receipt === undefined || (typeof r.receipt === "string" && r.receipt.length <= 32_000));
        })
      : [];
  } catch {
    return [];
  }
}

export function saveRoast(result: GradedRoast): StoredRoast {
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
    window.sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

/** A pointer into existing tab history, never a second copy of résumé content. */
export function selectRoastForOrder(roast: StoredRoast | null) {
  try {
    if (roast?.receipt && roast.persona && roast.personality) window.sessionStorage.setItem(ACTIVE_KEY, roast.id);
    else window.sessionStorage.removeItem(ACTIVE_KEY);
  } catch { /* Session history is optional. */ }
}

export function readRoastForOrder(persona: import("./roast-personas").PersonaId | null): StoredRoast | null {
  try {
    const id = window.sessionStorage.getItem(ACTIVE_KEY);
    return readRoasts().find((r) => r.id === id && r.persona === persona && r.receipt && r.personality && Date.now() - r.createdAt < 86400000) ?? null;
  } catch { return null; }
}
