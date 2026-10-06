/**
 * Shared result types. The old browser-driven "I've paid — write my résumé" generation
 * path was retired: paid delivery now runs only through src/lib/fulfillment (order-bound
 * checkout, Stripe-verified payment, server-side processing).
 */
import type { AtsReport } from "./order.server";

export type { AtsReport };
