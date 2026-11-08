/** Server wiring for operational safeguards (DB-backed breaker, heartbeat, owner alerts). Server-only. */
import {
  ALERT_DEDUPE_SECONDS, BREAKER_COOLDOWN_SECONDS, PROBE_LEASE_SECONDS,
  checkoutDecision, flushAlerts, ownerRecipient, type AlertRepo, type AlertSend, type BreakerGate, type CheckoutDecision,
} from "./guard";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const db = await admin();
  return (db.rpc as unknown as Rpc).call(db, fn, args);
}

// Hint only: lets a healthy isolate skip the close RPC; the DB row is the source of truth.
let maybeOpen = true;

/** Fails closed to "open" if the breaker state can't be read. */
export async function aiGate(): Promise<BreakerGate> {
  const { data, error } = await rpc("ai_breaker_gate", { _probe_lease_seconds: PROBE_LEASE_SECONDS }).catch(() => ({ data: null, error: true }));
  if (error || (data !== "closed" && data !== "probe" && data !== "open")) return "open";
  if (data !== "closed") maybeOpen = true;
  return data;
}

export async function noteGatewayOk(): Promise<void> {
  if (!maybeOpen) return;
  const { error } = await rpc("ai_breaker_close").catch(() => ({ error: true }));
  if (!error) maybeOpen = false;
}

/** Opens the breaker; on a fresh trip, expires unpaid open checkouts and alerts the owner. */
export async function tripOutage(code: string): Promise<void> {
  maybeOpen = true;
  const { data, error } = await rpc("ai_breaker_trip", { _code: code, _cooldown_seconds: BREAKER_COOLDOWN_SECONDS }).catch(() => ({ data: null, error: true }));
  if (error) { console.error("breaker trip failed"); return; }
  if (data !== true) return;
  console.error("generation outage: breaker opened", { code });
  await raiseAlert("gateway-outage", `Résumé generation is paused (${code}). Checkout is paused and free roasts show a pause message. Paid orders already queued are kept and will run without any new charge once generation works again. After adding credits, the next free roast after a 15-minute cooldown tests recovery automatically.`);
  await expireOpenCheckouts().catch(() => console.error("expire open checkouts failed"));
}

/** Expire still-open Stripe sessions for unpaid orders. A paid/complete session is never touched. */
export async function expireOpenCheckouts(limit = 25): Promise<number> {
  const db = await admin();
  const { data } = await db.from("fulfillment_orders").select("id,stripe_session_id,stripe_mode")
    .eq("status", "awaiting_payment").not("stripe_session_id", "is", null).gt("expires_at", new Date().toISOString()).limit(limit);
  const { getCheckoutSession, expireCheckoutSession } = await import("../stripe.server");
  let n = 0;
  for (const o of (data ?? []) as Array<{ stripe_session_id: string; stripe_mode: string }>) {
    const mode = o.stripe_mode === "test" ? "test" : "live";
    try {
      const s = await getCheckoutSession(o.stripe_session_id, mode);
      if (s.status === "open" && s.payment_status !== "paid") { await expireCheckoutSession(o.stripe_session_id, mode); n++; }
    } catch { /* complete/paid sessions refuse expiry; leave them */ }
  }
  return n;
}

export async function heartbeat(): Promise<void> {
  const { error } = await rpc("worker_heartbeat");
  if (error) throw new Error("heartbeat failed");
}

export async function checkoutAvailability(): Promise<CheckoutDecision> {
  try {
    const db = await admin();
    const { data } = await db.from("ops_state").select("key,data").in("key", ["ai_breaker", "worker"]);
    const rows = (data ?? []) as Array<{ key: string; data: Record<string, unknown> }>;
    const breaker = rows.find((r) => r.key === "ai_breaker")?.data?.["state"] === "open" ? "open" : "closed";
    const workerAt = (rows.find((r) => r.key === "worker")?.data?.["at"] as string | undefined) ?? null;
    const d = checkoutDecision({ hasGatewayKey: Boolean(process.env["LOVABLE_API_KEY"]), breaker, workerAt });
    if (!d.ok && d.reason === "worker_stale") {
      await raiseAlert("worker-stale", "Checkout was refused because the background order worker hasn't checked in for over 10 minutes. Check that the scheduled order sweep is active.");
    }
    return d;
  } catch {
    return checkoutDecision({ hasGatewayKey: false, breaker: "open", workerAt: null });
  }
}

/** Deduped (6h window); returns quickly — delivery happens in flush (inline + every worker run). */
export async function raiseAlert(key: string, detail: string): Promise<void> {
  const { data } = await rpc("ops_alert_raise", { _key: key, _detail: detail, _dedupe_seconds: ALERT_DEDUPE_SECONDS }).catch(() => ({ data: null }));
  if (data === true) await flushOwnerAlerts().catch(() => undefined);
}

const alertRepo: AlertRepo = {
  async due(limit) {
    const { data, error } = await rpc("ops_alerts_due", { _limit: limit });
    if (error) throw new Error("alerts due failed");
    return (data ?? []) as Array<{ key: string; detail: string; attempts: number }>;
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

async function ownerSender(): Promise<AlertSend | null> {
  const to = ownerRecipient(process.env["OWNER_ALERT_EMAIL"]);
  const { productionEmailPort } = await import("../fulfillment/email-transport.server");
  if (!to || !productionEmailPort.available()) return null;
  return (a) => productionEmailPort.send({ template: "owner-alert", to, data: { title: a.key, detail: a.detail, at: new Date().toISOString() }, idempotencyKey: a.idempotencyKey });
}

export async function flushOwnerAlerts(): Promise<string[]> {
  return flushAlerts(alertRepo, await ownerSender());
}
