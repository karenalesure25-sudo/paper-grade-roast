import { describe, expect, test } from "bun:test";
import { EmailAPIError } from "@lovable.dev/email-js";
import { createLovableEmailPort, mapEmailError } from "./email-transport.server";

const msg = { template: "order-ready" as const, to: "avery@kcs-test.dev", data: { firstName: "Avery", orderUrl: "https://paper-grade-roast.lovable.app/orders/x" }, idempotencyKey: "order-ready-o1" };

describe("managed email adapter", () => {
  test("disabled without a configured sender domain; nothing sent", async () => {
    let calls = 0;
    const p = createLovableEmailPort(() => ({ apiKey: "k" }), (async () => { calls++; return { success: true }; }) as never);
    expect(p.available()).toBe(false);
    expect(await p.send(msg)).toEqual({ status: "unconfigured" });
    expect(calls).toBe(0);
  });

  test("renders registered template and forwards idempotency key", async () => {
    const seen: Array<{ payload: Record<string, unknown>; opts: Record<string, unknown> }> = [];
    const p = createLovableEmailPort(() => ({ apiKey: "k", senderDomain: "notify.example.test" }),
      (async (payload: never, opts: never) => { seen.push({ payload, opts }); return { success: true }; }) as never);
    expect(p.available()).toBe(true);
    expect(await p.send(msg)).toEqual({ status: "sent" });
    const s = seen[0]!;
    expect(s.payload.idempotency_key).toBe("order-ready-o1");
    expect(s.opts.idempotencyKey).toBe("order-ready-o1");
    expect(s.payload.sender_domain).toBe("notify.example.test");
    expect(s.payload.purpose).toBe("transactional");
    expect(String(s.payload.html)).toContain("https://paper-grade-roast.lovable.app/orders/x");
  });

  test("error mapping", () => {
    expect(mapEmailError(new EmailAPIError(429, "x", null, "rate_limited"))).toEqual({ status: "retry", code: "rate_limited", retryAfterSeconds: 60 });
    expect(mapEmailError(new EmailAPIError(503, "x", null))).toMatchObject({ status: "retry" });
    expect(mapEmailError(new EmailAPIError(403, "x", null, "domain_not_verified"))).toEqual({ status: "unconfigured" });
    expect(mapEmailError(new EmailAPIError(403, "x", null, "emails_disabled"))).toEqual({ status: "unconfigured" });
    expect(mapEmailError(new EmailAPIError(422, "x", null, "recipient_suppressed"))).toEqual({ status: "suppressed" });
    expect(mapEmailError(new EmailAPIError(400, "x", null, "invalid_to"))).toEqual({ status: "permanent", code: "invalid_to" });
    expect(mapEmailError(new TypeError("fetch failed"))).toEqual({ status: "retry", code: "network" });
  });
});
