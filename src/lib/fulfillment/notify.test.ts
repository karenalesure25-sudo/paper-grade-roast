import { describe, expect, test } from "bun:test";
import { backoffSeconds, buildMessage, deliverNotification, MAX_NOTIFY_ATTEMPTS, type EmailMessage, type EmailPort, type EmailResult, type NotificationKind, type NotificationState, type NotifyRepo } from "./notify";
import type { OrderRow } from "./engine";

const ORIGIN = "https://paper-grade-roast.lovable.app";
function order(over: Partial<OrderRow> = {}): OrderRow & { notifications: Record<string, NotificationState> } {
  return {
    id: "o1", access_token: "11111111-1111-4111-8111-111111111111", tier: "bundle", email: "avery@kcs-test.dev", template: "classic",
    snapshot: { name: "Avery Stone", email: "avery@kcs-test.dev", phone: "1", requiredEmployers: [], requiredSchools: [], requiredCertifications: [], sourceLabel: "x" },
    source_text: "", job_text: null, stripe_session_id: "cs_1", status: "queued", attempts: 0, max_attempts: 3, retry_rounds: 0,
    locked_until: null, lease_id: null, paid_at: "2026-10-22T00:00:00Z", clarification_request: null, clarifications: [],
    result: null, failure_reason: null, expires_at: "2026-11-21T00:00:00Z", notifications: {}, ...over,
  };
}

/** Same claim semantics as claim_notification(): not done, under attempt cap, past backoff, unclaimed. */
function memRepo(row: ReturnType<typeof order>, clock: () => Date) {
  const claimed = new Set<string>();
  const repo: NotifyRepo = {
    async byId() { return row; },
    async claim(_id, kind) {
      const s = row.notifications[kind] ?? {};
      if (s.done || (s.attempts ?? 0) >= MAX_NOTIFY_ATTEMPTS || claimed.has(kind)) return false;
      if (s.nextAt && new Date(s.nextAt) > clock()) return false;
      claimed.add(kind); return true;
    },
    async finish(_id, kind, patch) { row.notifications[kind] = { ...(row.notifications[kind] ?? {}), ...patch }; claimed.delete(kind); },
  };
  return repo;
}

function port(results: EmailResult[], available = true) {
  const sent: EmailMessage[] = [];
  const p: EmailPort & { sent: EmailMessage[] } = {
    sent, available: () => available,
    async send(m) { sent.push(m); const r = results.shift() ?? { status: "sent" }; if ((r as { status: string }).status === "throw") throw new Error("x"); return r; },
  };
  return p;
}

describe("order emails", () => {
  const now = () => new Date("2026-10-22T01:00:00Z");

  test("no domain: nothing claimed, nothing sent, no attempts used", async () => {
    const row = order(); const p = port([], false);
    expect(await deliverNotification(memRepo(row, now), p, row.id, "confirmation", ORIGIN, now)).toBe("unconfigured");
    expect(p.sent.length).toBe(0);
    expect(row.notifications).toEqual({});
  });

  test("confirmation only after verified payment", async () => {
    const row = order({ paid_at: null, status: "awaiting_payment" }); const p = port([]);
    expect(await deliverNotification(memRepo(row, now), p, row.id, "confirmation", ORIGIN, now)).toBe("not_eligible");
    expect(p.sent.length).toBe(0);
  });

  test("ready email only when files are ready", async () => {
    const row = order({ status: "processing" }); const p = port([]);
    expect(await deliverNotification(memRepo(row, now), p, row.id, "ready", ORIGIN, now)).toBe("not_eligible");
    expect(p.sent.length).toBe(0);
  });

  test("sends once with stable idempotency key and trusted origin link", async () => {
    const row = order(); const p = port([{ status: "sent" }]); const repo = memRepo(row, now);
    expect(await deliverNotification(repo, p, row.id, "confirmation", ORIGIN, now)).toBe("sent");
    expect(await deliverNotification(repo, p, row.id, "confirmation", ORIGIN, now)).toBe("busy");
    expect(p.sent.length).toBe(1);
    expect(p.sent[0]!.idempotencyKey).toBe("order-confirmation-o1");
    expect(p.sent[0]!.data["orderUrl"]).toBe(`${ORIGIN}/orders/${row.access_token}`);
    expect(row.notifications["confirmation"]?.done).toBe(true);
  });

  test("failure never sets the success flag; retries after backoff", async () => {
    let t = now();
    const clock = () => t;
    const row = order(); const p = port([{ status: "retry", code: "rate_limited", retryAfterSeconds: 120 }, { status: "sent" }]); const repo = memRepo(row, clock);
    expect(await deliverNotification(repo, p, row.id, "confirmation", ORIGIN, clock)).toBe("retry");
    expect(row.notifications["confirmation"]?.done).toBeUndefined();
    expect(await deliverNotification(repo, p, row.id, "confirmation", ORIGIN, clock)).toBe("busy");
    t = new Date(t.getTime() + 121_000);
    expect(await deliverNotification(repo, p, row.id, "confirmation", ORIGIN, clock)).toBe("sent");
    expect(p.sent.map((m) => m.idempotencyKey)).toEqual(["order-confirmation-o1", "order-confirmation-o1"]);
  });

  test("thrown transport errors are retried, then give up without success flag", async () => {
    let t = now();
    const clock = () => t;
    const row = order(); const p = port(Array.from({ length: 10 }, () => ({ status: "throw" }) as unknown as EmailResult)); const repo = memRepo(row, clock);
    const outcomes: string[] = [];
    for (let i = 0; i < 8; i++) { outcomes.push(await deliverNotification(repo, p, row.id, "ready" as NotificationKind, ORIGIN, clock)); t = new Date(t.getTime() + 3_700_000); }
    row.status = "ready";
    expect(outcomes.every((o) => o === "not_eligible")).toBe(true);
    for (let i = 0; i < 8; i++) { outcomes.push(await deliverNotification(repo, p, row.id, "confirmation", ORIGIN, clock)); t = new Date(t.getTime() + 3_700_000); }
    expect(outcomes.filter((o) => o === "gave_up").length).toBe(1);
    expect(row.notifications["confirmation"]?.done).toBeUndefined();
    expect(row.notifications["confirmation"]?.gaveUp).toBe(true);
    expect(p.sent.length).toBe(MAX_NOTIFY_ATTEMPTS);
  });

  test("suppressed recipient is final, not retried", async () => {
    const row = order(); const p = port([{ status: "suppressed" }]); const repo = memRepo(row, now);
    expect(await deliverNotification(repo, p, row.id, "confirmation", ORIGIN, now)).toBe("suppressed");
    expect(row.notifications["confirmation"]?.outcome).toBe("suppressed");
  });

  test("ready message mentions cover letter only for bundle results", () => {
    const m = buildMessage(order({ status: "ready", result: { coverLetter: "x" } as never }), "ready", ORIGIN);
    expect(m.template).toBe("order-ready");
    expect(m.data["hasCoverLetter"]).toBe(true);
  });

  test("backoff grows and is capped", () => {
    expect(backoffSeconds(1)).toBe(60);
    expect(backoffSeconds(3)).toBe(240);
    expect(backoffSeconds(20)).toBe(3600);
    expect(backoffSeconds(1, 30)).toBe(30);
  });
});

describe("email templates render", () => {
  test("all three render with link and no unsubscribe text", async () => {
    const { render } = await import("@react-email/render");
    const { ORDER_EMAILS } = await import("../order-emails/templates");
    for (const [name, t] of Object.entries(ORDER_EMAILS)) {
      const C = t.component as (p: unknown) => React.ReactElement;
      const html = await render(C(t.previewData));
      expect(html).toContain("/orders/sample");
      expect(html.toLowerCase()).not.toContain("unsubscribe");
      expect(html).toContain("#ffffff");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
