/**
 * Operational safeguards (pure, testable). No I/O here.
 *
 * - Known-outage circuit breaker: a 402 (credits) or account-level 403 from the
 *   generation gateway opens it; free roasts and the paid worker stop calling the
 *   gateway, and checkout refuses new payments. After a cooldown exactly one caller
 *   may "probe" with a real request; its success closes the breaker. There is no
 *   no-cost balance API, so we never claim to predict credits — we react to them.
 * - Checkout fails closed when the worker heartbeat is stale/missing, the gateway
 *   key is missing, or the breaker is open.
 */

export type BreakerGate = "closed" | "probe" | "open";
export const BREAKER_COOLDOWN_SECONDS = 15 * 60;
export const PROBE_LEASE_SECONDS = 180;
export const WORKER_STALE_SECONDS = 10 * 60;

/** Gateway statuses that mean "the account can't spend right now" (never retried automatically). */
export function outageCode(status: number, type?: string | null): string | null {
  if (status === 402) return "credits_exhausted";
  if (status === 403 && type && /credit|limit|disabled|not_registered|policy/i.test(type)) return `blocked:${type.slice(0, 30)}`;
  if (status === 401) return "gateway_key_rejected";
  return null;
}

export function isTransient(status: number | undefined): boolean {
  return status === 429 || (typeof status === "number" && status >= 500);
}

export type CheckoutHealth = {
  hasGatewayKey: boolean;
  breaker: "closed" | "open";
  workerAt: string | null;
};

export type CheckoutDecision = { ok: true } | { ok: false; reason: "config" | "outage" | "worker_stale"; message: string };

export const CHECKOUT_PAUSED_MESSAGE =
  "Checkout is paused for a moment while we make sure your package can be prepared on time. Your saved order is safe — please try again later.";

export function checkoutDecision(h: CheckoutHealth, now = Date.now()): CheckoutDecision {
  if (!h.hasGatewayKey) return { ok: false, reason: "config", message: CHECKOUT_PAUSED_MESSAGE };
  if (h.breaker === "open") return { ok: false, reason: "outage", message: CHECKOUT_PAUSED_MESSAGE };
  const at = h.workerAt ? new Date(h.workerAt).getTime() : NaN;
  if (!Number.isFinite(at) || now - at > WORKER_STALE_SECONDS * 1000 || at - now > 60_000) {
    return { ok: false, reason: "worker_stale", message: CHECKOUT_PAUSED_MESSAGE };
  }
  return { ok: true };
}

/** Exponential backoff for transient gateway errors on paid orders (does not loop forever: attempts still count). */
export function transientBackoffSeconds(attempts: number): number {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 1800);
}

// ---------- Owner alerts ----------

export const ALERT_DEDUPE_SECONDS = 6 * 3600;
export const MAX_ALERT_ATTEMPTS = 6;

export type AlertSend = (a: { key: string; detail: string; idempotencyKey: string }) => Promise<
  { status: "sent" } | { status: "unconfigured" } | { status: "retry"; code: string; retryAfterSeconds?: number | null } | { status: "permanent"; code: string } | { status: "suppressed" }
>;

export type AlertRepo = {
  due(limit: number): Promise<Array<{ key: string; detail: string; attempts: number }>>;
  claim(key: string): Promise<string | null>;
  finish(key: string, token: string, patch: Record<string, unknown>): Promise<boolean>;
};

/** Sends pending owner alerts with fenced claims and backoff. Nothing is marked sent unless accepted. */
export async function flushAlerts(repo: AlertRepo, send: AlertSend | null, now = () => new Date(), limit = 5): Promise<string[]> {
  if (!send) return [];
  const out: string[] = [];
  for (const a of await repo.due(limit)) {
    const token = await repo.claim(a.key);
    if (!token) { out.push("busy"); continue; }
    const attempts = a.attempts + 1;
    let r: Awaited<ReturnType<AlertSend>>;
    try {
      r = await send({ key: a.key, detail: a.detail, idempotencyKey: `owner-alert-${a.key}-${token}` });
    } catch {
      r = { status: "retry", code: "send_threw" };
    }
    if (r.status === "sent" || r.status === "suppressed") {
      await repo.finish(a.key, token, { pending: false, sentAt: now().toISOString(), outcome: r.status, attempts });
      out.push(r.status);
    } else if (r.status === "unconfigured") {
      await repo.finish(a.key, token, {});
      out.push("unconfigured");
    } else if (r.status === "permanent" || attempts >= MAX_ALERT_ATTEMPTS) {
      await repo.finish(a.key, token, { pending: false, gaveUp: true, lastCode: r.code, attempts });
      out.push("gave_up");
    } else {
      const wait = r.retryAfterSeconds && r.retryAfterSeconds > 0 ? Math.min(r.retryAfterSeconds, 3600) : Math.min(60 * 2 ** (attempts - 1), 3600);
      await repo.finish(a.key, token, { attempts, lastCode: r.code, nextAt: new Date(now().getTime() + wait * 1000).toISOString() });
      out.push("retry");
    }
  }
  return out;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
/** Owner recipient comes only from server config, never from any order/customer data. */
export function ownerRecipient(raw: string | undefined): string | null {
  const v = raw?.trim();
  return v && EMAIL.test(v) ? v : null;
}
