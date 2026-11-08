import { describe, expect, test } from "bun:test";
import {
  checkoutDecision, flushAlerts, outageCode, ownerRecipient, transientBackoffSeconds, WORKER_STALE_SECONDS,
  type AlertRepo, type AlertSend,
} from "./guard";

const NOW = Date.parse("2026-11-08T15:00:00Z");
const fresh = new Date(NOW - 60_000).toISOString();

describe("outage classification", () => {
  test("402 is a credit outage", () => expect(outageCode(402)).toBe("credits_exhausted"));
  test("workspace limit 403 is an outage", () => expect(outageCode(403, "credit_limit_reached")).toBe("blocked:credit_limit_reached"));
  test("provider 403 is not", () => expect(outageCode(403, "permission_error")).toBe(null));
  test("429 and 500 are not outages", () => { expect(outageCode(429)).toBe(null); expect(outageCode(500)).toBe(null); });
  test("backoff is bounded", () => { expect(transientBackoffSeconds(1)).toBe(60); expect(transientBackoffSeconds(20)).toBe(1800); });
});

describe("checkout availability", () => {
  test("healthy → allowed", () => expect(checkoutDecision({ hasGatewayKey: true, breaker: "closed", workerAt: fresh }, NOW)).toEqual({ ok: true }));
  test("known outage → refused", () => expect(checkoutDecision({ hasGatewayKey: true, breaker: "open", workerAt: fresh }, NOW)).toMatchObject({ ok: false, reason: "outage" }));
  test("missing key → refused", () => expect(checkoutDecision({ hasGatewayKey: false, breaker: "closed", workerAt: fresh }, NOW)).toMatchObject({ ok: false, reason: "config" }));
  test("no heartbeat → refused", () => expect(checkoutDecision({ hasGatewayKey: true, breaker: "closed", workerAt: null }, NOW)).toMatchObject({ ok: false, reason: "worker_stale" }));
  test("stale heartbeat → refused", () =>
    expect(checkoutDecision({ hasGatewayKey: true, breaker: "closed", workerAt: new Date(NOW - (WORKER_STALE_SECONDS + 1) * 1000).toISOString() }, NOW)).toMatchObject({ ok: false, reason: "worker_stale" }));
  test("garbage heartbeat → refused", () => expect(checkoutDecision({ hasGatewayKey: true, breaker: "closed", workerAt: "nope" }, NOW).ok).toBe(false));
});

describe("owner recipient", () => {
  test("only a valid configured address", () => {
    expect(ownerRecipient(undefined)).toBe(null);
    expect(ownerRecipient("not-an-email")).toBe(null);
    expect(ownerRecipient(" owner@kcs-test.dev ")).toBe("owner@kcs-test.dev");
  });
});

function memAlerts(items: Array<{ key: string; detail: string }>) {
  const rows = new Map(items.map((i) => [i.key, { ...i, pending: true, attempts: 0, nextAt: 0, token: null as string | null } as Record<string, unknown>]));
  let n = 0;
  const repo: AlertRepo = {
    async due() { return [...rows.values()].filter((r) => r["pending"] && (r["nextAt"] as number) <= Date.now()).map((r) => ({ key: r["key"] as string, detail: r["detail"] as string, attempts: r["attempts"] as number, incident: `inc-${r["key"] as string}` })); },
    async claim(k) { const r = rows.get(k)!; if (r["token"]) return null; r["token"] = `t${++n}`; return r["token"] as string; },
    async finish(k, t, patch) {
      const r = rows.get(k)!; if (r["token"] !== t) return false;
      Object.assign(r, patch, { token: null });
      if (typeof patch["nextAt"] === "string") r["nextAt"] = Date.parse(patch["nextAt"] as string);
      return true;
    },
  };
  return { repo, rows };
}

describe("owner alerts", () => {
  test("no sender configured → nothing claimed or marked sent", async () => {
    const { repo, rows } = memAlerts([{ key: "gateway-outage", detail: "d" }]);
    expect(await flushAlerts(repo, null)).toEqual([]);
    expect(rows.get("gateway-outage")!["pending"]).toBe(true);
  });
  test("accepted send clears pending once; second flush sends nothing", async () => {
    const { repo, rows } = memAlerts([{ key: "gateway-outage", detail: "d" }]);
    const sent: string[] = [];
    const send: AlertSend = async (a) => { sent.push(a.key); return { status: "sent" }; };
    expect(await flushAlerts(repo, send)).toEqual(["sent"]);
    expect(await flushAlerts(repo, send)).toEqual([]);
    expect(sent).toEqual(["gateway-outage"]);
    expect(rows.get("gateway-outage")!["pending"]).toBe(false);
  });
  test("rate limited → backoff honors retryAfter, stays pending", async () => {
    const { repo, rows } = memAlerts([{ key: "k", detail: "d" }]);
    expect(await flushAlerts(repo, async () => ({ status: "retry", code: "429", retryAfterSeconds: 120 }))).toEqual(["retry"]);
    expect(rows.get("k")!["pending"]).toBe(true);
    expect(rows.get("k")!["nextAt"] as number).toBeGreaterThan(Date.now() + 100_000);
    expect(await flushAlerts(repo, async () => ({ status: "sent" }))).toEqual([]);
  });
  test("permanent failure gives up (no endless resend)", async () => {
    const { repo, rows } = memAlerts([{ key: "k", detail: "d" }]);
    expect(await flushAlerts(repo, async () => ({ status: "permanent", code: "bad" }))).toEqual(["gave_up"]);
    expect(rows.get("k")!["pending"]).toBe(false);
  });
  test("thrown send counts as retry, never sent", async () => {
    const { repo, rows } = memAlerts([{ key: "k", detail: "d" }]);
    expect(await flushAlerts(repo, async () => { throw new Error("x"); })).toEqual(["retry"]);
    expect(rows.get("k")!["sentAt"]).toBeUndefined();
  });
});
