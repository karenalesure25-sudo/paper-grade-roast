import { describe, expect, test } from "bun:test";
import { checkoutModeFor, livemodeMatches, sessionIdMode } from "./stripe-mode";
import { sessionPaysOrder, type StripeSessionView } from "./engine";

const order = { id: "o1", tier: "revamp" as const, email: "a@b.co", stripe_session_id: "cs_x" };
const paid = (livemode: boolean | undefined): StripeSessionView => ({
  id: "cs_x", mode: "payment", status: "complete", payment_status: "paid", amount_total: 4000, currency: "usd",
  metadata: { order_id: "o1", tier: "revamp", email: "a@b.co" }, client_reference_id: "o1", ...(livemode === undefined ? {} : { livemode }),
});

describe("stripe mode isolation", () => {
  test("published site is always live, even with a test key", () =>
    expect(checkoutModeFor("paper-grade-roast.lovable.app", true)).toBe("live"));
  test("preview host uses test mode only when a test key exists", () => {
    expect(checkoutModeFor("id-preview--656b31d5-ed91-45d2-b4a8-5acb422e4204.lovable.app", true)).toBe("test");
    expect(checkoutModeFor("id-preview--656b31d5-ed91-45d2-b4a8-5acb422e4204.lovable.app", false)).toBe("live");
  });
  test("unknown hosts are live", () => expect(checkoutModeFor("evil.example.com", true)).toBe("live"));
  test("test payment cannot pay a live order", () =>
    expect(sessionPaysOrder({ ...order, stripe_mode: "live" }, paid(false))).toEqual({ ok: false, reason: "mode_mismatch" }));
  test("live payment cannot pay a test order", () =>
    expect(sessionPaysOrder({ ...order, stripe_mode: "test" }, paid(true))).toEqual({ ok: false, reason: "mode_mismatch" }));
  test("missing livemode fails closed", () =>
    expect(sessionPaysOrder({ ...order, stripe_mode: "live" }, paid(undefined))).toEqual({ ok: false, reason: "mode_mismatch" }));
  test("matching test payment pays a test order", () => expect(sessionPaysOrder({ ...order, stripe_mode: "test" }, paid(false)).ok).toBe(true));
  test("test event never matches the live route", () => expect(livemodeMatches("live", false)).toBe(false));
  test("session id prefix marks ledger mode", () => expect(sessionIdMode("cs_test_abc")).toBe("test"));
});
