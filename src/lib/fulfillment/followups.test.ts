import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import { createElement } from "react";
import { buildMessage, deliverNotification, MAX_NOTIFY_ATTEMPTS, type EmailMessage, type EmailPort, type EmailResult, type NotificationState, type NotifyRepo } from "./notify";
import { followupEligible, type FollowupOrder } from "./followups";
import { ORDER_EMAILS } from "../order-emails/templates";
import { createLovableEmailPort, marketingEmailPort } from "./email-transport.server";

const ORIGIN = "https://paper-grade-roast.lovable.app";
const TOKEN = "11111111-1111-4111-8111-111111111111";
const PREF = "a".repeat(64);
const DELIVERED = "2026-10-22T12:00:00Z";
const day = (n: number) => new Date(new Date(DELIVERED).getTime() + n * 86_400_000);

function order(over: Partial<FollowupOrder> = {}): FollowupOrder & { notifications: Record<string, NotificationState> } {
  return {
    id: "o1", access_token: TOKEN, tier: "bundle", email: "avery@kcs-test.dev", template: "classic",
    snapshot: { name: "Avery Stone", email: "avery@kcs-test.dev", phone: "1", requiredEmployers: [], requiredSchools: [], requiredCertifications: [], sourceLabel: "x" },
    source_text: "", job_text: null, stripe_session_id: "cs_1", status: "ready", attempts: 0, max_attempts: 3, retry_rounds: 0,
    locked_until: null, lease_id: null, paid_at: "2026-10-21T00:00:00Z", clarification_request: null, clarifications: [],
    result: { resume: {} } as never, failure_reason: null, expires_at: "2026-11-20T00:00:00Z", delivered_at: DELIVERED,
    followup_opt_in: true, followup_unsubscribed_at: null, pref_token: PREF, stripe_mode: "live", notifications: {}, ...over,
  };
}

function memRepo(row: ReturnType<typeof order>) {
  const claimed = new Map<string, string>(); let n = 0;
  const repo: NotifyRepo = {
    async byId() { return row; },
    async claim(_id, kind) {
      const s = row.notifications[kind] ?? {};
      if (s.done || (s.attempts ?? 0) >= MAX_NOTIFY_ATTEMPTS || claimed.has(kind)) return null;
      const t = `t${++n}`; claimed.set(kind, t); return t;
    },
    async finish(_id, kind, token, patch) {
      if (claimed.get(kind) !== token) return false;
      row.notifications[kind] = { ...(row.notifications[kind] ?? {}), ...patch }; claimed.delete(kind); return true;
    },
  };
  return repo;
}
function port(results: EmailResult[] = []) {
  const sent: EmailMessage[] = [];
  return { sent, available: () => true, async send(m: EmailMessage) { sent.push(m); return results.shift() ?? { status: "sent" as const }; } } satisfies EmailPort & { sent: EmailMessage[] };
}
const html = (m: EmailMessage) => render(createElement(ORDER_EMAILS[m.template].component as never, m.data as never));

describe("transactional confirmation and ready emails", () => {
  test("confirmation thanks the customer by first name and names the exact purchased service", async () => {
    for (const [tier, name] of [["revamp", "Resume Revamp"], ["scratch", "Résumé From Scratch"], ["bundle", "Revamp + ATS Optimization"]] as const) {
      const m = buildMessage(order({ tier, status: "queued", result: null, delivered_at: null }), "confirmation", ORIGIN);
      const out = await html(m);
      expect(out).toContain("Thank you for your purchase, Avery!");
      expect(out).toContain(name);
      expect(out.includes("cover letter included")).toBe(tier === "bundle");
      expect(out).toContain("24–48 eligible hours, Sundays excluded");
      expect(out).not.toMatch(/\b(damn|hell|shit|fuck\w*|ass)\b/i);
      expect(out).not.toMatch(/files are ready|download your files/i);
      expect(m.data["orderUrl"]).toBe(`${ORIGIN}/orders/${TOKEN}`);
    }
  });

  test("ready email only once files exist; exactly one send per idempotency key", async () => {
    const early = order({ status: "processing", result: null, delivered_at: null });
    const p = port();
    expect(await deliverNotification(memRepo(early), p, "o1", "ready", ORIGIN)).toBe("not_eligible");
    const row = order(); const repo = memRepo(row);
    expect(await deliverNotification(repo, p, "o1", "ready", ORIGIN)).toBe("sent");
    expect(await deliverNotification(repo, p, "o1", "ready", ORIGIN)).toBe("busy");
    expect(p.sent.map((m) => m.idempotencyKey)).toEqual(["order-ready-o1"]);
    expect(await html(p.sent[0]!)).toContain("7 calendar days");
  });
});

describe("opt-in follow-ups", () => {
  test("timing: review at 3 days and interview at 14 days after delivery, never before", () => {
    expect(followupEligible(order(), "followup:review", day(2.9))).toBe(false);
    expect(followupEligible(order(), "followup:review", day(3))).toBe(true);
    expect(followupEligible(order(), "followup:interview", day(13.9))).toBe(false);
    expect(followupEligible(order(), "followup:interview", day(14))).toBe(true);
  });

  test("missing opt-in, unsubscribe, test mode, unpaid, not ready, expired or missing pref token are suppressed", () => {
    const at = day(20 - 5);
    for (const o of [
      order({ followup_opt_in: false }), order({ followup_opt_in: null }), order({ followup_unsubscribed_at: "2026-10-23T00:00:00Z" }),
      order({ stripe_mode: "test" }), order({ paid_at: null }), order({ status: "processing" }), order({ result: null }),
      order({ delivered_at: null }), order({ pref_token: null }), order({ expires_at: "2026-10-25T00:00:00Z" }),
    ]) expect(followupEligible(o, "followup:review", at)).toBe(false);
  });

  test("deliverNotification sends nothing when not opted in, and exactly once when opted in", async () => {
    const p = port(); const now = () => day(4);
    expect(await deliverNotification(memRepo(order({ followup_opt_in: false })), p, "o1", "followup:review", ORIGIN, now)).toBe("not_eligible");
    expect(p.sent).toHaveLength(0);
    const row = order(); const repo = memRepo(row);
    expect(await deliverNotification(repo, p, "o1", "followup:review", ORIGIN, now)).toBe("sent");
    expect(await deliverNotification(repo, p, "o1", "followup:review", ORIGIN, now)).toBe("busy");
    expect(p.sent).toHaveLength(1);
    expect(p.sent[0]!.idempotencyKey).toBe("followup-review-o1");
  });

  test("retry with capped backoff, then gives up without duplicates", async () => {
    const row = order(); const repo = memRepo(row); const now = () => day(15);
    const p = port([{ status: "retry", code: "http_503" }]);
    expect(await deliverNotification(repo, p, "o1", "followup:interview", ORIGIN, now)).toBe("retry");
    expect(row.notifications["followup:interview"]?.attempts).toBe(1);
    expect(row.notifications["followup:interview"]?.nextAt).toBe(new Date(day(15).getTime() + 60_000).toISOString());
  });

  test("follow-up emails link only to the public site and preference page — never the private order link", async () => {
    for (const kind of ["followup:review", "followup:interview"] as const) {
      const m = buildMessage(order(), kind, ORIGIN);
      const out = await html(m);
      expect(out).not.toContain(TOKEN);
      expect(out).not.toContain("/orders/");
      expect(JSON.stringify(m.data)).not.toContain(TOKEN);
      const hrefs = [...out.matchAll(/href="([^"]+)"/g)].map((x) => x[1]!);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const h of hrefs) expect(h.startsWith(`${ORIGIN}/`)).toBe(true);
      expect(out).toContain(`/email-preferences/${PREF}`);
      expect(out).toMatch(/unsubscribe/i);
      expect(out).not.toMatch(/guarantee|will get (you )?hired/i);
    }
  });

  test("commercial follow-ups are never sent through the transactional app-email sender", async () => {
    let calls = 0;
    const app = createLovableEmailPort(() => ({ senderDomain: "notify.example.com", apiKey: "k" }), (async () => { calls++; return { success: true }; }) as never);
    expect(await app.send(buildMessage(order(), "followup:review", ORIGIN))).toEqual({ status: "unconfigured" });
    expect(calls).toBe(0);
    expect(marketingEmailPort.available()).toBe(false);
    expect(ORDER_EMAILS["followup-review"].purpose).toBe("commercial");
    expect(ORDER_EMAILS["followup-interview"].purpose).toBe("commercial");
  });
});
