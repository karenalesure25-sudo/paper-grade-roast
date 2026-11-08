/** Server wiring for operational safeguards (DB-backed breaker, heartbeat, owner alerts). Server-only. */
import {
  ALERT_DEDUPE_SECONDS, BREAKER_COOLDOWN_SECONDS, PROBE_LEASE_SECONDS,
  checkoutDecision, expireUnpaidSessions, flushAlerts, ownerRecipient,
  type AlertRepo, type AlertSend, type BreakerState, type CheckoutDecision, type ProbeCtx, type SessionPort, type UnpaidSession,
} from "./guard";

type Res = { data: unknown; error: unknown };
/** Minimal DB surface used here; production is the service-role client, tests inject a fake. */
export type OpsDb = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<Res>;
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

let injected: OpsDb | null = null;
let injectedSessions: SessionPort | null = null;
/** Test seam: route the real wiring through an in-memory DB (and Stripe port). Never used in production. */
export function __setOpsDbForTests(db: OpsDb | null, sessions: SessionPort | null = null) {
  injected = db;
  injectedSessions = sessions;
}

async function admin(): Promise<OpsDb> {
  if (injected) return injected;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as OpsDb;
}
async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<Res> {
  const db = await admin();
  return db.rpc(fn, args);
}

/** Read-only breaker state; never acquires a probe. Fails closed to "open". */
export async function breakerState(): Promise<BreakerState> {
  const { data, error } = await rpc("ai_breaker_state").catch(() => ({ data: null, error: true }));
  if (error || (data !== "closed" && data !== "probe_ready" && data !== "open")) return "open";
  return data;
}

/** Acquire the single recovery probe. Call only immediately before a real gateway request. */
export async function acquireProbe(): Promise<string | null> {
  const { data, error } = await rpc("ai_breaker_acquire_probe", { _lease_seconds: PROBE_LEASE_SECONDS }).catch(() => ({ data: null, error: true }));
  return !error && typeof data === "string" && data ? data : null;
}

/** Closes the breaker only if this token still owns the probe (a newer trip supersedes it). */
export async function closeProbe(token: string): Promise<boolean> {
  const { data, error } = await rpc("ai_breaker_close_probe", { _token: token }).catch(() => ({ data: null, error: true }));
  return !error && data === true;
}

export async function releaseProbe(token: string): Promise<void> {
  await rpc("ai_breaker_release_probe", { _token: token }).catch(() => undefined);
}

/**
 * Called after a gateway call succeeded. Non-probe callers never touch the breaker.
 * The probe owner closes it (awaited). Returns false if the probe was superseded by a newer outage.
 */
export async function settleProbe(ctx: ProbeCtx | undefined): Promise<boolean> {
  const token = ctx?.probe;
  if (!token) return true;
  ctx.probe = undefined;
  return closeProbe(token);
}

/** Releases a probe that never produced a successful call (so the next caller can probe). */
export async function finishProbe(ctx: ProbeCtx): Promise<void> {
  const token = ctx.probe;
  ctx.probe = undefined;
  if (token) await releaseProbe(token);
}

/** Opens the breaker; on a fresh trip, expires unpaid open checkouts and alerts the owner. */
export async function tripOutage(code: string): Promise<void> {
  const { data, error } = await rpc("ai_breaker_trip", { _code: code, _cooldown_seconds: BREAKER_COOLDOWN_SECONDS }).catch(() => ({ data: null, error: true }));
  if (error) { console.error("breaker trip failed"); return; }
  if (data !== true) return;
  console.error("generation outage: breaker opened", { code });
  await raiseAlert("gateway-outage", `Résumé generation is paused (${code}). Checkout is paused and free roasts show a pause message. Paid orders already queued are kept and will run without any new charge once generation works again. After adding credits, the next free roast or queued order after a 15-minute cooldown tests recovery automatically.`);
  await expireOpenCheckouts().catch(() => console.error("expire open checkouts failed"));
}

/** Expire every still-open Stripe session for unpaid orders (paginated). Paid/complete sessions are never touched. */
export async function expireOpenCheckouts(): Promise<number> {
  const db = await admin();
  const page = async (after: string | null, n: number): Promise<UnpaidSession[]> => {
    let q = db.from("fulfillment_orders").select("id,stripe_session_id,stripe_mode")
      .eq("status", "awaiting_payment").not("stripe_session_id", "is", null).gt("expires_at", new Date().toISOString());
    if (after) q = q.gt("id", after);
    const { data, error } = await q.order("id", { ascending: true }).limit(n);
    if (error) throw new Error("unpaid session page failed");
    return (data ?? []) as UnpaidSession[];
  };
  let sessions = injectedSessions;
  if (!sessions) {
    const { getCheckoutSession, expireCheckoutSession } = await import("../stripe.server");
    sessions = { get: (id, m) => getCheckoutSession(id, m), expire: (id, m) => expireCheckoutSession(id, m) };
  }
  return (await expireUnpaidSessions(page, sessions)).expired;
}

/** Records a successful worker run. Call only after the sweep completed. */
export async function heartbeat(): Promise<void> {
  const { error } = await rpc("worker_heartbeat");
  if (error) throw new Error("heartbeat failed");
}

export async function checkoutAvailability(): Promise<CheckoutDecision> {
  try {
    const db = await admin();
    const { data, error } = await db.from("ops_state").select("key,data").in("key", ["ai_breaker", "worker"]);
    if (error) throw new Error("ops read failed");
    const rows = (data ?? []) as Array<{ key: string; data: Record<string, unknown> }>;
    const breaker = rows.find((r) => r.key === "ai_breaker")?.data?.["state"] === "open" ? "open" : "closed";
    const workerAt = (rows.find((r) => r.key === "worker")?.data?.["at"] as string | undefined) ?? null;
    const d = checkoutDecision({ hasGatewayKey: Boolean(process.env["LOVABLE_API_KEY"]), breaker, workerAt });
    if (!d.ok && d.reason === "worker_stale") {
      await raiseAlert("worker-stale", "Checkout was refused because the background order worker hasn't completed a run for over 10 minutes. Check that the scheduled order sweep is active and succeeding.");
    }
    return d;
  } catch {
    return checkoutDecision({ hasGatewayKey: false, breaker: "open", workerAt: null });
  }
}

/** Deduped (6h window) recurring condition; delivery happens in flush (inline + every worker run). */
export async function raiseAlert(key: string, detail: string): Promise<void> {
  const { data } = await rpc("ops_alert_raise", { _key: key, _detail: detail, _dedupe_seconds: ALERT_DEDUPE_SECONDS }).catch(() => ({ data: null }));
  if (data === true) await flushOwnerAlerts().catch(() => undefined);
}

/** One alert per incident key, ever (e.g. one order's failure round). Returns true if newly raised. */
export async function raiseIncidentAlert(key: string, detail: string): Promise<boolean> {
  const { data, error } = await rpc("ops_alert_raise_once", { _key: key, _detail: detail });
  if (error) throw new Error("alert raise failed");
  return data === true;
}

const alertRepo: AlertRepo = {
  async due(limit) {
    const { data, error } = await rpc("ops_alerts_due_v2", { _limit: limit });
    if (error) throw new Error("alerts due failed");
    return (data ?? []) as Array<{ key: string; detail: string; attempts: number; incident: string }>;
  },
  async claim(key) {
    const { data, error } = await rpc("ops_alert_claim", { _key: key, _lease_seconds: 120 });
    if (error) throw new Error("alert claim failed");
    return typeof data === "string" ? data : null;
  },
  async finish(key, token, patch) {
    const { data, error } = await rpc("ops_alert_finish", { _key: key, _token: token, _patch: patch });
    if (error) throw new Error("alert finish failed");
    return data === true;
  },
};

export function ownerAlertConfigured(): boolean {
  return ownerRecipient(process.env["OWNER_ALERT_EMAIL"]) !== null;
}

let injectedSender: AlertSend | null | undefined;
/** Test seam for the owner-alert transport. */
export function __setOwnerSenderForTests(s: AlertSend | null | undefined) { injectedSender = s; }

async function ownerSender(): Promise<AlertSend | null> {
  if (injectedSender !== undefined) return injectedSender;
  const to = ownerRecipient(process.env["OWNER_ALERT_EMAIL"]);
  const { productionEmailPort } = await import("../fulfillment/email-transport.server");
  if (!to || !productionEmailPort.available()) return null;
  return (a) => productionEmailPort.send({ template: "owner-alert", to, data: { title: a.key, detail: a.detail, at: new Date().toISOString() }, idempotencyKey: a.idempotencyKey });
}

export async function flushOwnerAlerts(): Promise<string[]> {
  return flushAlerts(alertRepo, await ownerSender());
}
