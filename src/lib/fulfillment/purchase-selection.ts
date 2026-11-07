import type { PersonaId } from "../roast-personas";
import type { Snapshot } from "./engine";

/** Recovery always uses the order, never a device's newer personality preference. */
export function recoveredPurchaseSelection(order: { template: string; photo?: string | null; snapshot: Snapshot }) {
  return { template: order.template, photo: order.photo ?? null, roastPersona: order.snapshot.roastPersona ?? null, roastLabel: order.snapshot.originalRoast?.label ?? null };
}
/** A purchase's presentation is immutable from the first saved snapshot, not from payment. */
export function assertPurchaseSelection(
  saved: { template: string; photo?: string | null; roastPersona?: PersonaId | null | undefined },
  requested: { template: string; photo?: string | null; roastPersona?: PersonaId | null | undefined },
) {
  if (saved.template !== requested.template || (saved.photo ?? null) !== (requested.photo ?? null) || (saved.roastPersona ?? null) !== (requested.roastPersona ?? null)) {
    throw new Error("This saved order already has a saved selection. Refresh to review it, or submit a new intake to change your selection.");
  }
}
