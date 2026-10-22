/**
 * Stripe live/test isolation rules (pure, testable).
 * An order's mode is fixed at creation; every Stripe call, webhook and payment
 * check for that order must use the same mode, so a test payment can never
 * unlock a live order (or the reverse).
 */
export type StripeMode = "live" | "test";

const PROJECT_ID = "656b31d5-ed91-45d2-b4a8-5acb422e4204";
const TEST_HOSTS = new Set([
  `id-preview--${PROJECT_ID}.lovable.app`,
  `project--${PROJECT_ID}-dev.lovable.app`,
  "localhost",
  "127.0.0.1",
]);

/** Test checkout only on preview hosts, and only when a test key exists. Production is always live. */
export function checkoutModeFor(host: string, hasTestKey: boolean): StripeMode {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return hasTestKey && TEST_HOSTS.has(h) ? "test" : "live";
}

export function modeOf(order: { stripe_mode?: StripeMode | null }): StripeMode {
  return order.stripe_mode === "test" ? "test" : "live";
}

/** Stripe reports `livemode`; it must match the expected mode exactly (missing = mismatch). */
export function livemodeMatches(mode: StripeMode, livemode: boolean | undefined | null): boolean {
  return livemode === (mode === "live");
}

export function sessionIdMode(sessionId: string): StripeMode {
  return sessionId.startsWith("cs_test_") ? "test" : "live";
}
