/**
 * Production wiring of the outage breaker, probe ownership and owner alerts, exercised through the real
 * ops.server / roast.server / writer.server code with an injected in-memory DB (no global module mock).
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { installFakeOps, type FakeOpsDb } from "./fake-ops-db";
import { acquireProbe, breakerState, expireOpenCheckouts, flushOwnerAlerts, raiseAlert, raiseIncidentAlert, __setOpsDbForTests } from "./ops.server";
import { gradeResumeText } from "../roast.server";
import { liveModels, liveRevisionModels, makeLiveModels } from "../fulfillment/writer.server";
import type { SourceFacts } from "../fulfillment/validate";

const RESUME = `Jordan Rivera
Operations Coordinator | Chicago, IL
Experience
Operations Coordinator, Northwind Logistics, 2021 to present
Coordinated weekly shipping schedules for regional warehouses and resolved carrier delays with vendors.
Maintained inventory records in the warehouse system and trained new staff on receiving procedures.
Education
Bachelor of Science in Business Administration, Illinois State University, 2020
Skills
Scheduling, inventory control, vendor communication, Excel, process documentation`;

const FACTS = { tier: "revamp", text: RESUME, name: "Jordan Rivera", email: "j@kcs-test.dev", phone: "312-555-0100" } as unknown as SourceFacts;
const ok = (body: unknown) => new Response(JSON.stringify({ output_text: JSON.stringify(body) }), { status: 200 });
const fail = (status: number) => new Response(JSON.stringify({ type: "payment_required" }), { status });

let db: FakeOpsDb;
const realFetch = globalThis.fetch;
beforeEach(() => { db = installFakeOps(); process.env["LOVABLE_API_KEY"] = "test-key"; });
afterEach(() => { globalThis.fetch = realFetch; delete process.env["LOVABLE_API_KEY"]; __setOpsDbForTests(null); });

async function openAndCool() {
  await db.rpc("ai_breaker_trip", { _code: "credits_exhausted", _cooldown_seconds: 900 });
  db.elapseCooldown();
}

describe("free roast", () => {
  test("open breaker: no gateway call, pause message", async () => {
    await db.rpc("ai_breaker_trip", { _code: "credits_exhausted", _cooldown_seconds: 900 });
    const f = mock(async () => ok({}));
    globalThis.fetch = f as unknown as typeof fetch;
    expect(await gradeResumeText(RESUME, "text")).toEqual({ status: "unavailable", message: "Grading is paused right now. Try again later." });
    expect(f).toHaveBeenCalledTimes(0);
    expect(db.calls).not.toContain("ai_breaker_acquire_probe");
  });

  test("402 trips the shared breaker through the real wiring and stops after one call", async () => {
    const f = mock(async () => fail(402));
    globalThis.fetch = f as unknown as typeof fetch;
    expect((await gradeResumeText(RESUME, "text")).status).toBe("unavailable");
    expect(f).toHaveBeenCalledTimes(1);
    expect(db.breaker()?.["state"]).toBe("open");
    expect(await breakerState()).toBe("open");
  });

  test("probe owner's successful call closes the breaker (awaited, before grading continues)", async () => {
    await openAndCool();
    let stateAtStream: unknown = null;
    globalThis.fetch = (async () => {
      return new Response(new ReadableStream({ start(c) { stateAtStream = db.breaker()?.["state"]; c.close(); } }), { status: 200 });
    }) as unknown as typeof fetch;
    await gradeResumeText(RESUME, "text");
    expect(db.breaker()?.["state"]).toBe("closed");
    expect(stateAtStream).toBe("closed");
  });

  test("probe is released when the call never succeeds (network error)", async () => {
    await openAndCool();
    globalThis.fetch = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    await gradeResumeText(RESUME, "text");
    expect(db.breaker()?.["state"]).toBe("open");
    expect(db.breaker()?.["probeToken"]).toBeUndefined();
    expect(await breakerState()).toBe("probe_ready");
  });

  test("a second visitor while the probe is held makes no call", async () => {
    await openAndCool();
    expect(await acquireProbe()).toBeString();
    const f = mock(async () => ok({}));
    globalThis.fetch = f as unknown as typeof fetch;
    expect((await gradeResumeText(RESUME, "text")).status).toBe("unavailable");
    expect(f).toHaveBeenCalledTimes(0);
  });

  test("unreadable input never acquires a probe", async () => {
    await openAndCool();
    await gradeResumeText("too short", "text");
    expect(db.calls).not.toContain("ai_breaker_acquire_probe");
  });
});

describe("paid writer/checker wiring", () => {
  test("a concurrent non-probe 200 never closes a newer outage", async () => {
    globalThis.fetch = (async () => {
      await db.rpc("ai_breaker_trip", { _code: "credits_exhausted", _cooldown_seconds: 900 }); // outage opens mid-flight
      return ok({ approved: true, problems: [] });
    }) as unknown as typeof fetch;
    expect((await liveModels.check(FACTS, {})).approved).toBe(true);
    expect(db.breaker()?.["state"]).toBe("open");
    expect(db.calls).not.toContain("ai_breaker_close_probe");
  });

  test("a superseded probe cannot close the breaker and surfaces as an outage", async () => {
    await openAndCool();
    const ctx = { probe: (await acquireProbe())! };
    globalThis.fetch = (async () => {
      await db.rpc("ai_breaker_trip", { _code: "credits_exhausted", _cooldown_seconds: 900 });
      return ok({ approved: true, problems: [] });
    }) as unknown as typeof fetch;
    await expect(makeLiveModels(ctx).check(FACTS, {})).rejects.toMatchObject({ outage: "probe_superseded" });
    expect(db.breaker()?.["state"]).toBe("open");
  });

  test("probe owner success closes", async () => {
    await openAndCool();
    const ctx = { probe: (await acquireProbe())! };
    globalThis.fetch = (async () => ok({ approved: true, problems: [] })) as unknown as typeof fetch;
    await makeLiveModels(ctx).check(FACTS, {});
    expect(db.breaker()?.["state"]).toBe("closed");
    expect(ctx.probe).toBeUndefined();
  });

  for (const [name, run] of [
    ["fact-checker", () => liveModels.check(FACTS, {})],
    ["revision triage", () => liveRevisionModels.classify({ facts: FACTS, delivered: { resume: {} } as never, kind: "minor", request: "Reword bullet one.", clarifications: [] })],
    ["scope reviewer", () => liveRevisionModels.scopeCheck({ facts: FACTS, delivered: { resume: {} } as never, kind: "minor", request: "Reword bullet one.", clarifications: [] }, { resume: {} } as never)],
  ] as const) {
    test(`${name}: 402 trips the breaker itself and is rethrown, not turned into a rejection`, async () => {
      globalThis.fetch = (async () => fail(402)) as unknown as typeof fetch;
      await expect((run as () => Promise<unknown>)()).rejects.toMatchObject({ status: 402, outage: "credits_exhausted" });
      expect(db.breaker()?.["state"]).toBe("open");
    });
  }

  test("a transient 500 from the checker is still a fail-closed rejection (no trip)", async () => {
    globalThis.fetch = (async () => fail(500)) as unknown as typeof fetch;
    expect(await liveModels.check(FACTS, {})).toEqual({ approved: false, problems: ["Fact-checker unavailable"] });
    expect(db.breaker()).toBeNull();
  });
});

describe("owner alerts and checkout expiry", () => {
  test("idempotency key is stable per incident across transport retries", async () => {
    const keys: string[] = [];
    const replies = [{ status: "retry" as const, code: "x" }, { status: "sent" as const }];
    db = installFakeOps({ sender: async (a) => { keys.push(a.idempotencyKey); return replies.shift()!; } });
    await raiseAlert("gateway-outage", "paused");
    const row = db.state.get("alert:gateway-outage")!;
    row["nextAt"] = new Date(Date.now() - 1).toISOString();
    await flushOwnerAlerts();
    expect(keys.length).toBe(2);
    expect(keys[0]).toBe(keys[1]!);
    expect(row["pending"]).toBe(false);
  });

  test("incident alerts are raised once per key", async () => {
    expect(await raiseIncidentAlert("order-failed-a-r0", "x")).toBe(true);
    expect(await raiseIncidentAlert("order-failed-a-r0", "x")).toBe(false);
    expect(await raiseIncidentAlert("order-failed-a-r1", "x")).toBe(true);
  });

  test("expiry walks past the first page so later sessions aren't starved", async () => {
    const expired: string[] = [];
    db = installFakeOps({ sessions: {
      get: async (id) => ({ status: id.endsWith("-paid") ? "complete" : "open", payment_status: id.endsWith("-paid") ? "paid" : "unpaid" }),
      expire: async (id) => { expired.push(id); },
    } });
    db.unpaid = Array.from({ length: 60 }, (_, i) => ({ id: `o${String(i).padStart(3, "0")}`, stripe_session_id: `cs_${i}${i === 59 ? "-paid" : ""}`, stripe_mode: "live" }));
    expect(await expireOpenCheckouts()).toBe(59);
    expect(expired).toContain("cs_58");
    expect(expired).not.toContain("cs_59-paid");
  });
});
