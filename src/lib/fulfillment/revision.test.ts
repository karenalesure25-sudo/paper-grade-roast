import { describe, expect, test } from "bun:test";
import type { DeliveredPackage, OrderRow } from "./engine";
import {
  answerRevision, minorRevisionState, processRevision, requestRevision, retryRevision, scopeViolations, screenRequest, settleStaleRevision,
  type Classification, type RequestOutcome, type RevisionKind, type RevisionModelPort, type RevisionRepo, type RevisionRow,
} from "./revision";
import { minorRevisionWindowEnd } from "./service-time";
import type { FullResume } from "./validate";
import type { WriterOutput } from "./writer.server";
import { buildMessage, deliverNotification, type EmailMessage, type NotificationState, type NotifyRepo } from "./notify";

// Synthetic, isolated data only.
const SOURCE = `Avery Stone
Operations Coordinator
Northwind Logistics, Operations Coordinator, Jan 2019 - Mar 2023, Denver CO
Coordinated inbound freight schedules for twelve regional carriers and maintained dispatch records in SAP.
Trained four new hires on warehouse safety procedures and inventory counts using Excel.
Bluepeak Retail, Shift Supervisor, Jun 2016 - Dec 2018, Denver CO
Supervised a team of eight associates, handled cash reconciliation and opened and closed the store.
Education: University of Colorado Denver, Bachelor of Arts in Business, 2016
Skills: SAP, Excel, scheduling, inventory control, team training, customer service, freight coordination`;

function resume(role = "Operations Coordinator", firstBullet = "Coordinated inbound freight schedules for twelve regional carriers using SAP."): FullResume {
  return {
    name: "Avery Stone", email: "avery@kcs-test.dev", phone: "303-555-2211",
    title: "Operations Coordinator", location: "Denver CO",
    summary: "Operations coordinator experienced in freight coordination, scheduling and inventory control across logistics and retail settings.",
    objective: "",
    experience: [
      { company: "Northwind Logistics", role, location: "Denver CO", dates: "Jan 2019 - Mar 2023",
        bullets: [firstBullet, "Trained four new hires on warehouse safety and inventory counts."] },
      { company: "Bluepeak Retail", role: "Shift Supervisor", location: "Denver CO", dates: "Jun 2016 - Dec 2018",
        bullets: ["Supervised a team of eight associates and handled cash reconciliation."] },
    ],
    education: [{ school: "University of Colorado Denver", credential: "Bachelor of Arts in Business", dates: "2016" }],
    skills: ["SAP", "Excel", "scheduling", "inventory control"], certifications: [],
  };
}

const CHECKS = { deterministic: "passed", independent: "passed", exports: "passed", generations: 1 } as const;
const DELIVERED_AT = "2026-10-05T20:00:00Z"; // Mon Oct 5, 3:00pm CDT

function order(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "o1", access_token: "11111111-1111-4111-8111-111111111111", tier: "revamp", email: "avery@kcs-test.dev", template: "sidebar", photo: null,
    snapshot: { name: "Avery Stone", email: "avery@kcs-test.dev", phone: "303-555-2211", requiredEmployers: [], requiredSchools: [], requiredCertifications: [], sourceLabel: "r.pdf" },
    source_text: SOURCE, job_text: null, stripe_session_id: "cs_1", status: "ready", attempts: 1, max_attempts: 3, retry_rounds: 0,
    locked_until: null, lease_id: null, paid_at: "2026-10-04T15:00:00Z", clarification_request: null, clarifications: [],
    result: { resume: resume(), validatedAt: DELIVERED_AT, checks: CHECKS } as DeliveredPackage,
    failure_reason: null, expires_at: "2026-11-03T00:00:00Z", delivered_at: DELIVERED_AT, ...over,
  };
}

/** In-memory repo mirroring request_order_revision / claim_revision semantics. */
function memRepo(o: OrderRow, clock: () => Date = () => new Date("2026-10-06T15:00:00Z")) {
  const rows = new Map<string, RevisionRow>();
  let n = 0;
  let failRequest = false;
  const repo: RevisionRepo = {
    async order() { return o; },
    async request(orderId, kind, text, idem, deadline) {
      if (failRequest) throw new Error("db down");
      const mine = [...rows.values()].filter((r) => r.order_id === orderId);
      const dup = mine.find((r) => r.idempotency_key === idem);
      if (dup) return { outcome: "duplicate" as RequestOutcome, id: dup.id };
      if (!o.paid_at || o.status !== "ready" || !o.delivered_at) return { outcome: "not_eligible" as RequestOutcome };
      if (mine.some((r) => ["queued", "processing", "needs_information"].includes(r.status))) return { outcome: "pending" as RequestOutcome };
      if (mine.length >= 6) return { outcome: "limit" as RequestOutcome };
      if (kind === "minor") {
        if (clock() >= minorRevisionWindowEnd(o.delivered_at)) return { outcome: "window_closed" as RequestOutcome };
        if (mine.some((r) => r.kind === "minor" && r.status === "ready")) return { outcome: "already_used" as RequestOutcome };
      } else if (mine.filter((r) => r.kind === "correction").length >= 3) return { outcome: "limit" as RequestOutcome };
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      const latest = mine.filter((r) => r.status === "ready" && r.version).sort((a, b) => b.version! - a.version!)[0];
      rows.set(id, {
        base_revision_id: latest?.id ?? null, base_version: latest?.version ?? 1,
        id, order_id: orderId, kind, status: "queued", request_text: text, idempotency_key: idem, clarifications: [], clarification_request: null,
        requested_at: clock().toISOString(), deadline_at: deadline, attempts: 0, max_attempts: 3, retry_rounds: 0, lease_id: null, locked_until: null,
        result: null, version: null, failure_reason: null, completed_at: null,
      });
      return { outcome: "created" as RequestOutcome, id };
    },
    async byId(id) { const r = rows.get(id); return r ? { ...r } : null; },
    async forOrder(id) { return [...rows.values()].filter((r) => r.order_id === id).map((r) => ({ ...r })); },
    async claim(id) {
      const r = rows.get(id);
      if (!r || r.attempts >= r.max_attempts || o.status !== "ready") return null;
      const stale = r.status === "processing" && r.locked_until && new Date(r.locked_until) < new Date();
      if (r.status !== "queued" && !stale) return null;
      Object.assign(r, { status: "processing", attempts: r.attempts + 1, lease_id: `L${++n}`, locked_until: new Date(Date.now() + 600_000).toISOString() });
      return { ...r };
    },
    async finish(id, lease, patch) {
      const r = rows.get(id);
      if (!r || r.status !== "processing" || r.lease_id !== lease) return null;
      Object.assign(r, patch); return { ...r };
    },
    async renew(id, lease) { const r = rows.get(id); return Boolean(r && r.status === "processing" && r.lease_id === lease); },
    async transition(id, from, patch) { const r = rows.get(id); if (!r || !from.includes(r.status)) return null; Object.assign(r, patch); return { ...r }; },
    async retry(id) {
      const r = rows.get(id);
      if (!r) return "not_found";
      if (r.status !== "failed") return "not_failed";
      if (o.status !== "ready" || (o.expires_at && new Date(o.expires_at) <= clock())) return "expired";
      if (r.retry_rounds >= 2) return "limit";
      const mine = [...rows.values()].filter((x) => x.order_id === r.order_id && x.id !== id);
      if (mine.some((x) => ["queued", "processing", "needs_information"].includes(x.status))) return "pending";
      if (r.kind === "minor" && mine.some((x) => x.kind === "minor" && x.status === "ready")) return "already_used";
      const latest = mine.filter((x) => x.status === "ready" && x.version).sort((a, b) => b.version! - a.version!)[0];
      Object.assign(r, { status: "queued", attempts: 0, retry_rounds: r.retry_rounds + 1, failure_reason: null, base_revision_id: latest?.id ?? null, base_version: latest?.version ?? 1 });
      return "queued";
    },
    async settleStale(id, lease, reason) {
      const r = rows.get(id);
      if (!r || r.status !== "processing" || r.lease_id !== lease || !r.locked_until || new Date(r.locked_until).getTime() >= Date.now() || r.attempts < r.max_attempts) return false;
      Object.assign(r, { status: "failed", lease_id: null, locked_until: null, failure_reason: reason });
      return true;
    },
    async nextVersion(id) { return Math.max(1, ...[...rows.values()].filter((r) => r.order_id === id && r.version).map((r) => r.version!)) + 1; },
  };
  return { repo, rows, setFailRequest: (v: boolean) => { failRequest = v; } };
}

type Step = "good" | "hallucinate" | "throw" | "ask" | "rewrite";
function models(opts: { cls?: Partial<Classification> | "throw"; steps?: Step[]; checker?: boolean[]; scope?: boolean[]; edit?: (base: FullResume) => FullResume } = {}) {
  const steps = opts.steps ?? ["good"];
  const m: RevisionModelPort & { revises: number; classified: number } = {
    revises: 0, classified: 0,
    async classify() {
      m.classified++;
      if (opts.cls === "throw") throw new Error("model down");
      return { scope: "minor", reason: "", ...(opts.cls ?? {}) } as Classification;
    },
    async revise(input): Promise<WriterOutput> {
      const s = steps[Math.min(m.revises++, steps.length - 1)];
      if (opts.edit) { const { name: _n, email: _e, phone: _p, ...rest } = opts.edit(structuredClone(input.delivered.resume)); return { kind: "package", resume: rest, keywords: [] }; }
      if (s === "rewrite") {
        // Grounded but unsolicited: every bullet and the summary reworded.
        const r = resume("Operations Coordinator", "Managed freight schedules for twelve regional carriers in SAP.");
        r.summary = "Logistics and retail professional focused on scheduling, inventory control and team training.";
        r.experience[0]!.bullets[1] = "Onboarded four new hires on warehouse safety and inventory counts.";
        r.experience[1]!.bullets[0] = "Led a team of eight associates and owned cash reconciliation.";
        r.skills = ["Excel", "SAP"];
        const { name: _n, email: _e, phone: _p, ...rest } = r;
        return { kind: "package", resume: rest, keywords: [] };
      }
      if (s === "throw") throw new Error("model down");
      if (s === "ask") return { kind: "needs_information", questions: ["Which bullet?"] };
      const r = resume("Operations Coordinator", s === "hallucinate"
        ? "Coordinated freight for 40 carriers and cut costs 25% using SAP."
        : "Scheduled inbound freight for twelve regional carriers and kept dispatch records in SAP.");
      const { name: _n, email: _e, phone: _p, ...rest } = r;
      return { kind: "package", resume: rest, keywords: [] };
    },
    async check() { const ok = opts.checker?.length ? opts.checker.shift()! : true; return { approved: ok, problems: ok ? [] : ["unsupported claim"] }; },
    async scopeCheck() { const ok = opts.scope?.length ? opts.scope.shift()! : true; return { approved: ok, problems: ok ? [] : ["unrequested changes"] }; },
  };
  return m;
}

const NOW = new Date("2026-10-06T15:00:00Z");
async function reserve(repo: RevisionRepo, o: OrderRow, kind: RevisionKind = "minor", text = "Reword the first Northwind bullet so it reads more naturally.", idem = "key-00000001", now = NOW) {
  return requestRevision(repo, o, kind, text, idem, now);
}

describe("revision eligibility", () => {
  test("unpaid, not-ready, undelivered and expired orders are refused", async () => {
    for (const o of [order({ paid_at: null }), order({ status: "processing" }), order({ delivered_at: null })]) {
      const r = await reserve(memRepo(o).repo, o);
      expect(r.ok).toBe(false);
    }
    const expired = order({ expires_at: "2026-10-06T00:00:00Z" });
    const r = await reserve(memRepo(expired).repo, expired);
    expect(r).toMatchObject({ ok: false, reason: "expired" });
  });

  test("7-day window: open through end of 7th Central calendar day, closed at the boundary", async () => {
    const end = minorRevisionWindowEnd(DELIVERED_AT);
    expect(end.toISOString()).toBe("2026-10-13T05:00:00.000Z"); // Tue Oct 13 00:00 CDT
    const o = order();
    const before = await reserve(memRepo(o, () => new Date(end.getTime() - 1)).repo, o, "minor", undefined, "key-00000001", new Date(end.getTime() - 1));
    expect(before.ok).toBe(true);
    const at = await reserve(memRepo(o, () => end).repo, o, "minor", undefined, "key-00000001", end);
    expect(at).toMatchObject({ ok: false, reason: "window_closed" });
  });

  test("window starts at delivery, not payment or creation", () => {
    const o = order({ paid_at: "2026-09-01T00:00:00Z" });
    expect(minorRevisionState(o, [], new Date("2026-10-10T00:00:00Z"))).toBe("available");
  });

  test("invalid or overlong feedback is rejected without reserving", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    expect((await reserve(repo, o, "minor", "short")).ok).toBe(false);
    expect((await reserve(repo, o, "minor", "x".repeat(1501))).ok).toBe(false);
    expect(rows.size).toBe(0);
  });
});

describe("reservation and consumption", () => {
  test("duplicate submit with the same key reserves once", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const [a, b] = await Promise.all([reserve(repo, o), reserve(repo, o)]);
    expect(a.ok && b.ok).toBe(true);
    expect(rows.size).toBe(1);
  });

  test("a second request is blocked while one is pending", async () => {
    const o = order(); const { repo } = memRepo(o);
    await reserve(repo, o);
    expect(await reserve(repo, o, "correction", "The title says Operations Manager but I was a Coordinator.", "key-00000002")).toMatchObject({ ok: false, reason: "pending" });
  });

  test("infrastructure failure on request throws and consumes nothing", async () => {
    const o = order(); const m = memRepo(o); m.setFailRequest(true);
    await expect(reserve(m.repo, o)).rejects.toThrow();
    expect(m.rows.size).toBe(0);
  });

  test("only a completed validated minor revision consumes the entitlement", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    expect(await processRevision(repo, models({ steps: ["throw"] }), r.id)).toBe("queued");
    expect(minorRevisionState(o, [...rows.values()], NOW)).toBe("pending");
    expect(await processRevision(repo, models(), r.id)).toBe("ready");
    expect(minorRevisionState(o, [...rows.values()], NOW)).toBe("used");
    expect(await reserve(repo, o, "minor", "Another tweak to the summary wording please.", "key-00000009")).toMatchObject({ ok: false, reason: "already_used" });
  });

  test("failure after max attempts keeps original, allows bounded retry, and does not consume", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    const m = models({ steps: ["throw"] });
    for (let i = 0; i < 3; i++) await processRevision(repo, m, r.id);
    const row = rows.get(r.id)!;
    expect(row.status).toBe("failed");
    expect(o.result!.resume.experience[0]!.bullets[0]).toContain("Coordinated inbound freight");
    expect(minorRevisionState(o, [...rows.values()], NOW)).toBe("available");
    expect((await retryRevision(repo, row)).ok).toBe(true);
    expect(await processRevision(repo, models(), r.id)).toBe("ready");
  });

  test("concurrent workers: only one claims; stale lease cannot overwrite", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    const outs = await Promise.all([processRevision(repo, models(), r.id), processRevision(repo, models(), r.id)]);
    expect(outs.filter((x) => x === "ready").length).toBe(1);
    expect(outs).toContain("busy");
    expect(await repo.finish(r.id, "L-stale", { status: "failed" })).toBeNull();
    expect(rows.get(r.id)!.status).toBe("ready");
  });
});

describe("scope, corrections and grounding", () => {
  test("forbidden scope is declined without consuming", async () => {
    for (const t of ["Please switch to a different template.", "Tailor it for a different job at Acme.", "Do a complete rewrite of everything.", "Add a new job at Contoso from 2024."]) {
      expect(screenRequest(t)).not.toBeNull();
    }
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o, "minor", "Please switch to a different template for this."); if (!r.ok) throw new Error("reserve");
    expect(await processRevision(repo, models(), r.id)).toBe("rejected");
    expect(minorRevisionState(o, [...rows.values()], NOW)).toBe("available");
  });

  test("model-classified out of scope declines; unclear asks one question", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    expect(await processRevision(repo, models({ cls: { scope: "unclear", question: "Which bullet?" } }), r.id)).toBe("needs_information");
    expect(rows.get(r.id)!.clarification_request).toBe("Which bullet?");
    await answerRevision(repo, rows.get(r.id)!, "The first bullet under Northwind Logistics.");
    expect(await processRevision(repo, models(), r.id)).toBe("ready");
  });

  test("triage outage fails closed and is retried, never auto-approved", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    const m = models({ cls: "throw" });
    expect(await processRevision(repo, m, r.id)).toBe("queued");
    expect(m.revises).toBe(0);
    expect(rows.get(r.id)!.result).toBeNull();
  });

  test("proven introduced error is corrected free and separate from the minor revision", async () => {
    const o = order({ result: { resume: resume("Operations Manager"), validatedAt: DELIVERED_AT, checks: CHECKS } as DeliveredPackage });
    const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o, "correction", "My Northwind title shows Operations Manager but I was Operations Coordinator."); if (!r.ok) throw new Error("reserve");
    const m = models({ cls: { scope: "minor", introducedError: { deliveredQuote: "Operations Manager", sourceQuote: "Operations Coordinator" } } });
    expect(await processRevision(repo, m, r.id)).toBe("ready");
    expect(minorRevisionState(o, [...rows.values()], NOW)).toBe("available");
  });

  test("self-labeled correction without proof is declined and consumes nothing", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o, "correction", "You got my title wrong, make it Senior Director."); if (!r.ok) throw new Error("reserve");
    // Delivered text is grounded in source, so this cannot be an error we introduced.
    const m = models({ cls: { scope: "minor", introducedError: { deliveredQuote: "Operations Coordinator", sourceQuote: "Operations Coordinator" } } });
    expect(await processRevision(repo, m, r.id)).toBe("rejected");
    expect(m.revises).toBe(0);
    expect(rows.get(r.id)!.failure_reason).toContain("couldn’t confirm");
  });

  test("hallucinated numbers in a revision never ship", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    const m = models({ steps: ["hallucinate"] });
    for (let i = 0; i < 3; i++) await processRevision(repo, m, r.id);
    const row = rows.get(r.id)!;
    expect(row.status).toBe("failed");
    expect(row.result).toBeNull();
  });

  test("independent checker rejection is required to pass", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    expect(await processRevision(repo, models({ checker: [false, false, false] }), r.id)).toBe("queued");
    expect(rows.get(r.id)!.result).toBeNull();
  });

  test("original package preserved; revision versioned; identity fixed from intake", async () => {
    const o = order(); const original = JSON.stringify(o.result);
    const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    await processRevision(repo, models(), r.id);
    const row = rows.get(r.id)!;
    expect(JSON.stringify(o.result)).toBe(original);
    expect(row.version).toBe(2);
    expect(row.result!.resume.name).toBe("Avery Stone");
    expect(row.result!.resume.experience[0]!.bullets[0]).toContain("Scheduled inbound freight");
  });
});

describe("revision ready email", () => {
  test("per-version idempotency; initial ready ledger does not suppress it", async () => {
    const o = order() as OrderRow & { notifications: Record<string, NotificationState> };
    o.notifications = { ready: { done: true, outcome: "sent" } };
    const claimed = new Map<string, string>();
    const repo: NotifyRepo = {
      async byId() { return o; },
      async revision(_o, id) { return { id, version: 2, status: "ready" }; },
      async claim(_id, kind) { const s = o.notifications[kind] ?? {}; if (s.done || claimed.has(kind)) return null; claimed.set(kind, "t"); return "t"; },
      async finish(_id, kind, tok, patch) { if (claimed.get(kind) !== tok) return false; o.notifications[kind] = { ...(o.notifications[kind] ?? {}), ...patch }; claimed.delete(kind); return true; },
    };
    const sent: EmailMessage[] = [];
    const port = { available: () => true, async send(m: EmailMessage) { sent.push(m); return { status: "sent" as const }; } };
    expect(await deliverNotification(repo, port, "o1", "revision:rev-a", "https://paper-grade-roast.lovable.app")).toBe("sent");
    expect(await deliverNotification(repo, port, "o1", "revision:rev-a", "https://paper-grade-roast.lovable.app")).toBe("busy");
    expect(await deliverNotification(repo, port, "o1", "revision:rev-b", "https://paper-grade-roast.lovable.app")).toBe("sent");
    expect(sent.map((m) => m.idempotencyKey)).toEqual(["revision-ready-rev-a", "revision-ready-rev-b"]);
    expect(sent[0]!.template).toBe("revision-ready");
    expect(buildMessage(o, "ready", "https://x").idempotencyKey).toBe("order-ready-o1");
  });
});

describe("revision base, retry and stale fencing (review follow-up)", () => {
  test("correction after a ready minor builds on v2, fixes a v2-introduced error, and keeps v2 changes in v3", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const a = await reserve(repo, o); if (!a.ok) throw new Error("reserve");
    // v2: requested bullet rewording, but it also introduced a wrong title.
    const v2m = models({ edit: (r) => { r.experience[0]!.bullets[0] = "Scheduled inbound freight for twelve regional carriers and kept dispatch records in SAP."; r.experience[0]!.role = "Operations Manager"; return r; } });
    expect(await processRevision(repo, v2m, a.id)).toBe("ready");
    const v2 = structuredClone(rows.get(a.id)!);
    expect(v2.version).toBe(2);

    const c = await reserve(repo, o, "correction", "My Northwind title now shows Operations Manager but I was Operations Coordinator.", "key-00000002");
    if (!c.ok) throw new Error("reserve correction");
    expect(rows.get(c.id)!).toMatchObject({ base_revision_id: a.id, base_version: 2 });
    let seenBase = "";
    const fix = models({
      cls: { scope: "minor", introducedError: { deliveredQuote: "Operations Manager", sourceQuote: "Operations Coordinator" } },
      edit: (r) => { seenBase = r.experience[0]!.bullets[0]!; r.experience[0]!.role = "Operations Coordinator"; return r; },
    });
    expect(await processRevision(repo, fix, c.id)).toBe("ready");
    const v3 = rows.get(c.id)!;
    expect(seenBase).toContain("Scheduled inbound freight");
    expect(v3.version).toBe(3);
    expect(v3.result!.resume.experience[0]!.role).toBe("Operations Coordinator");
    expect(v3.result!.resume.experience[0]!.bullets[0]).toContain("Scheduled inbound freight");
    // Prior versions untouched.
    expect(rows.get(a.id)).toEqual(v2);
    expect(o.result!.resume.experience[0]!.bullets[0]).toContain("Coordinated inbound freight");
  });

  test("the v2-only error can't be proven against the original, so the base matters", async () => {
    const o = order();
    const { provesIntroducedError } = await import("./revision");
    const ev = { deliveredQuote: "Operations Manager", sourceQuote: "Operations Coordinator" };
    expect(provesIntroducedError(o, o.result, ev)).toBe(false);
    expect(provesIntroducedError(o, { resume: resume("Operations Manager") }, ev)).toBe(true);
  });

  test("retry of an old failed minor is refused once another minor is ready", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const a = await reserve(repo, o); if (!a.ok) throw new Error("reserve");
    for (let i = 0; i < 3; i++) await processRevision(repo, models({ steps: ["throw"] }), a.id);
    expect(rows.get(a.id)!.status).toBe("failed");
    const b = await reserve(repo, o, "minor", "Reword the Bluepeak bullet to sound more natural.", "key-00000003"); if (!b.ok) throw new Error("reserve b");
    expect(await processRevision(repo, models(), b.id)).toBe("ready");
    const res = await retryRevision(repo, rows.get(a.id)!);
    expect(res).toMatchObject({ ok: false, reason: "already_used" });
    expect(res.message).toContain("already been delivered");
    expect(rows.get(a.id)!.status).toBe("failed");
  });

  test("retry is refused while another request is open, and after the order expires", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const a = await reserve(repo, o); if (!a.ok) throw new Error("reserve");
    for (let i = 0; i < 3; i++) await processRevision(repo, models({ steps: ["throw"] }), a.id);
    const c = await reserve(repo, o, "correction", "The Northwind title is wrong in the delivered file.", "key-00000004"); if (!c.ok) throw new Error("reserve c");
    expect(await retryRevision(repo, rows.get(a.id)!)).toMatchObject({ ok: false, reason: "pending" });
    rows.get(c.id)!.status = "rejected";
    o.expires_at = "2026-10-06T00:00:00Z";
    expect(await retryRevision(repo, rows.get(a.id)!)).toMatchObject({ ok: false, reason: "expired" });
    expect(rows.get(a.id)!.status).toBe("failed");
  });

  test("stale settle is fenced on lease: a renewed/reclaimed claim survives a stale read", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const a = await reserve(repo, o); if (!a.ok) throw new Error("reserve");
    const row = rows.get(a.id)!;
    Object.assign(row, { status: "processing", attempts: 3, lease_id: "L-old", locked_until: new Date(Date.now() - 1000).toISOString() });
    const staleRead = structuredClone(row);
    Object.assign(row, { lease_id: "L-new", locked_until: new Date(Date.now() + 600_000).toISOString() });
    const out = await settleStaleRevision(repo, staleRead);
    expect(rows.get(a.id)!).toMatchObject({ status: "processing", lease_id: "L-new" });
    expect(out.status).toBe("processing");
    // A genuinely stale lease still settles.
    Object.assign(row, { locked_until: new Date(Date.now() - 1000).toISOString() });
    expect((await settleStaleRevision(repo, structuredClone(row))).status).toBe("failed");
  });
});

describe("revision scope validation (review follow-up)", () => {
  test("grounded but unsolicited rewrite is rejected deterministically and never ships", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    const m = models({ steps: ["rewrite"] });
    for (let i = 0; i < 3; i++) await processRevision(repo, m, r.id);
    expect(rows.get(r.id)!).toMatchObject({ status: "failed", result: null });
    expect(scopeViolations(resume(), (() => { const x = resume(); x.summary = "Different."; x.skills = ["SAP"]; x.experience.forEach((e) => { e.bullets = e.bullets.map((b) => b + " Reworded."); }); return x; })()).map((v) => v.code)).toContain("scope_rewrite");
  });

  test("independent scope reviewer rejection fails closed", async () => {
    const o = order(); const { repo, rows } = memRepo(o);
    const r = await reserve(repo, o); if (!r.ok) throw new Error("reserve");
    expect(await processRevision(repo, models({ scope: [false, false, false] }), r.id)).toBe("queued");
    expect(rows.get(r.id)!.result).toBeNull();
  });

  test("structure changes and no-op revisions are rejected; a single requested edit passes", () => {
    const base = resume();
    const dropped = resume(); dropped.experience.pop();
    expect(scopeViolations(base, dropped).map((v) => v.code)).toContain("scope_structure");
    expect(scopeViolations(base, resume()).map((v) => v.code)).toContain("scope_no_change");
    expect(scopeViolations(base, resume("Operations Coordinator", "Scheduled inbound freight for twelve regional carriers."))).toEqual([]);
  });
});
