/** A purchase's presentation is immutable from the first saved snapshot, not from payment. */
export function assertPurchaseSelection(
  saved: { template: string; photo?: string | null },
  requested: { template: string; photo?: string | null },
) {
  if (saved.template !== requested.template || (saved.photo ?? null) !== (requested.photo ?? null)) {
    throw new Error("This saved order already has a layout and photo. Refresh to review its saved selection, or submit a new intake for a different layout.");
  }
}