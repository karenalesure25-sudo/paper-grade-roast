import { describe, expect, test } from "bun:test";
import { GENERIC_RECOVERY_MESSAGE, RECOVERY_UNAVAILABLE_MESSAGE, RECOVERY_LIMITS, requestOrderLinks, type RecoveryDeps } from "./recovery";
import type { EmailMessage } from "./notify";

function deps(orders: Record<string, Array<{ access_token: string; tier: string; status: string }>>, available = true) {
  const log: Array<[string, string]> = [];
  const sent: EmailMessage[] = [];
  const d: RecoveryDeps = {
    hash: async (v) => `h(${v})`,
    // Mirrors admit_recovery_request(): count and insert happen in one critical section.
    admit: async (e, i) => {
      if (log.filter(([a]) => a === e).length >= RECOVERY_LIMITS.perEmailPerHour || log.filter(([, b]) => b === i).length >= RECOVERY_LIMITS.perIpPerHour) return false;
      log.push([e, i]); return true;
    },
    ordersFor: async (e) => orders[e] ?? [],
    port: { available: () => available, send: async (m) => { sent.push(m); return { status: "sent" }; } },
    origin: "https://paper-grade-roast.lovable.app",
    now: () => new Date("2026-10-22T01:00:00Z"),
  };
  return { d, sent, log };
}

describe("lost-link recovery", () => {
  const known = { "avery@kcs-test.dev": [{ access_token: "tok-1", tier: "revamp", status: "ready" }] };

  test("same response for known and unknown emails (non-enumerating)", async () => {
    const a = deps(known); const b = deps(known);
    const r1 = await requestOrderLinks("Avery@KCS-test.dev", "1.1.1.1", a.d);
    const r2 = await requestOrderLinks("nobody@kcs-test.dev", "1.1.1.1", b.d);
    expect(r1).toEqual(r2);
    expect(r1).toEqual({ ok: true, message: GENERIC_RECOVERY_MESSAGE });
    expect(a.sent.length).toBe(1);
    expect(b.sent.length).toBe(0);
  });

  test("links go only to the address on file, with trusted origin", async () => {
    const a = deps(known);
    await requestOrderLinks("avery@kcs-test.dev", "1.1.1.1", a.d);
    expect(a.sent[0]!.to).toBe("avery@kcs-test.dev");
    expect(JSON.stringify(a.sent[0]!.data)).toContain("https://paper-grade-roast.lovable.app/orders/tok-1");
  });

  test("rate limited per email and per IP", async () => {
    const a = deps(known);
    for (let i = 0; i < RECOVERY_LIMITS.perEmailPerHour; i++) await requestOrderLinks("avery@kcs-test.dev", `ip${i}`, a.d);
    expect((await requestOrderLinks("avery@kcs-test.dev", "ipX", a.d)).ok).toBe(false);
    const b = deps(known);
    for (let i = 0; i < RECOVERY_LIMITS.perIpPerHour; i++) await requestOrderLinks(`u${i}@kcs-test.dev`, "9.9.9.9", b.d);
    const r = await requestOrderLinks("avery@kcs-test.dev", "9.9.9.9", b.d);
    expect(r.ok).toBe(false);
    expect(b.sent.length).toBe(0);
  });

  test("raw email and IP are never stored, only hashes", async () => {
    const a = deps(known);
    await requestOrderLinks("avery@kcs-test.dev", "1.1.1.1", a.d);
    expect(a.log[0]).toEqual(["h(email:avery@kcs-test.dev)", "h(ip:1.1.1.1)"]);
  });

  test("disabled truthfully until email is active", async () => {
    const a = deps(known, false);
    const r = await requestOrderLinks("avery@kcs-test.dev", "1.1.1.1", a.d);
    expect(r.ok).toBe(false);
    expect(a.sent.length).toBe(0);
    expect(a.log.length).toBe(0);
  });

  test("invalid email rejected", async () => {
    expect((await requestOrderLinks("not-an-email", "1", deps(known).d)).ok).toBe(false);
  });

  test("concurrent burst admits at most the per-email limit", async () => {
    const a = deps(known);
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => requestOrderLinks("avery@kcs-test.dev", `ip${i}`, a.d)));
    expect(rs.filter((r) => r.ok).length).toBe(RECOVERY_LIMITS.perEmailPerHour);
    expect(a.log.length).toBe(RECOVERY_LIMITS.perEmailPerHour);
  });

  test("database error fails closed: no send, generic retry message", async () => {
    const a = deps(known);
    a.d.admit = async () => { throw new Error("db down"); };
    const r = await requestOrderLinks("avery@kcs-test.dev", "1.1.1.1", a.d);
    expect(r).toEqual({ ok: false, reason: "unavailable", message: RECOVERY_UNAVAILABLE_MESSAGE });
    expect(a.sent.length).toBe(0);
  });

  test("generic reply never claims an email was already sent", () => {
    expect(GENERIC_RECOVERY_MESSAGE).toContain("If that email is eligible, you will receive");
    expect(GENERIC_RECOVERY_MESSAGE).not.toMatch(/we've sent|we have sent/i);
  });
});
