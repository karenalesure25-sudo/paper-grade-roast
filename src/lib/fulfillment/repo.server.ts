/** Supabase-backed repository for fulfillment orders (service role, server-only). */
import type { TierId } from "../products";
import type { OrderRow, OrderStatus, Repo } from "./engine";
import { MAX_REVISION_RETRIES, type RetryOutcome, type RevisionRepo, type RevisionRow } from "./revision";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const T = "fulfillment_orders" as never;

export const supabaseRepo: Repo = {
  async byId(id) {
    const db = await admin();
    const { data } = await db.from(T).select("*").eq("id", id).maybeSingle();
    return (data as OrderRow | null) ?? null;
  },
  async bySession(sessionId) {
    const db = await admin();
    const { data } = await db.from(T).select("*").eq("stripe_session_id", sessionId).maybeSingle();
    return (data as OrderRow | null) ?? null;
  },
  async transition(id, from: OrderStatus[], patch) {
    const db = await admin();
    const { data, error } = await db.from(T).update(patch as never).eq("id", id).in("status", from).select("*").maybeSingle();
    if (error) {
      console.error("order transition failed", { code: error.code });
      throw new Error("order update failed");
    }
    return (data as OrderRow | null) ?? null;
  },
  async finish(id, leaseId, patch) {
    const db = await admin();
    const { data, error } = await db.from(T).update(patch as never).eq("id", id).eq("status", "processing").eq("lease_id", leaseId).select("*").maybeSingle();
    if (error) throw new Error("order update failed");
    return (data as OrderRow | null) ?? null;
  },
  async renew(id, leaseId) {
    const db = await admin();
    const { data, error } = await db.rpc("renew_fulfillment_lease" as never, { _order_id: id, _lease_id: leaseId, _lease_seconds: 600 } as never);
    if (error) throw new Error("lease renew failed");
    return data === true;
  },
  async claim(id) {
    const db = await admin();
    const { data, error } = await db.rpc("claim_fulfillment" as never, { _order_id: id, _lease_seconds: 600 } as never);
    if (error) throw new Error("claim failed");
    const rows = (data ?? []) as OrderRow[];
    return rows[0] ?? null;
  },
  async due(limit) {
    const db = await admin();
    const { data } = await db.rpc("due_fulfillments" as never, { _limit: limit } as never);
    return ((data ?? []) as unknown[]).map((r) => (typeof r === "string" ? r : (r as { due_fulfillments: string }).due_fulfillments));
  },
  async recordRedemption(sessionId, tier: TierId, email, status) {
    const db = await admin();
    const cents = { revamp: 4000, scratch: 5000, bundle: 6000 }[tier];
    const { error } = await db.from("payment_redemptions").upsert(
      { session_id: sessionId, tier, amount_cents: cents, email: email.toLowerCase(), status, updated_at: new Date().toISOString() },
      { onConflict: "session_id" },
    );
    if (error) throw new Error("redemption ledger write failed");
  },
};

export async function orderByToken(token: string): Promise<OrderRow | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;
  const db = await admin();
  const { data } = await db.from(T).select("*").eq("access_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  return (data as OrderRow | null) ?? null;
}

const RV = "order_revisions" as never;

export const revisionRepo: RevisionRepo = {
  order: (id) => supabaseRepo.byId(id),
  async request(orderId, kind, text, idem, deadline) {
    const db = await admin();
    const { data, error } = await db.rpc("request_order_revision" as never, { _order_id: orderId, _kind: kind, _text: text, _idem: idem, _deadline: deadline } as never);
    if (error) throw new Error("revision request failed");
    return data as { outcome: never; id?: string };
  },
  async byId(id) {
    const db = await admin();
    const { data } = await db.from(RV).select("*").eq("id", id).maybeSingle();
    return (data as RevisionRow | null) ?? null;
  },
  async forOrder(orderId) {
    const db = await admin();
    const { data, error } = await db.from(RV).select("*").eq("order_id", orderId).order("requested_at", { ascending: true });
    if (error) throw new Error("revision read failed");
    return (data ?? []) as RevisionRow[];
  },
  async claim(id) {
    const db = await admin();
    const { data, error } = await db.rpc("claim_revision" as never, { _id: id, _lease_seconds: 600 } as never);
    if (error) throw new Error("revision claim failed");
    return ((data ?? []) as RevisionRow[])[0] ?? null;
  },
  async finish(id, lease, patch) {
    const db = await admin();
    const { data, error } = await db.from(RV).update(patch as never).eq("id", id).eq("status", "processing").eq("lease_id", lease).select("*").maybeSingle();
    if (error) throw new Error("revision update failed");
    return (data as RevisionRow | null) ?? null;
  },
  async renew(id, lease) {
    const db = await admin();
    const { data, error } = await db.from(RV).update({ locked_until: new Date(Date.now() + 600_000).toISOString() } as never)
      .eq("id", id).eq("status", "processing").eq("lease_id", lease).select("id").maybeSingle();
    if (error) throw new Error("revision renew failed");
    return Boolean(data);
  },
  async transition(id, from, patch) {
    const db = await admin();
    const { data, error } = await db.from(RV).update(patch as never).eq("id", id).in("status", from).select("*").maybeSingle();
    if (error) throw new Error("revision update failed");
    return (data as RevisionRow | null) ?? null;
  },
  async nextVersion(orderId) {
    const db = await admin();
    const { data, error } = await db.from(RV).select("version").eq("order_id", orderId).not("version", "is", null).order("version", { ascending: false }).limit(1);
    if (error) throw new Error("revision version read failed");
    const top = ((data ?? []) as Array<{ version: number }>)[0]?.version ?? 1;
    return Math.max(1, top) + 1;
  },
  async retry(id) {
    const db = await admin();
    const { data, error } = await db.rpc("retry_order_revision" as never, { _id: id, _max_rounds: MAX_REVISION_RETRIES } as never);
    if (error) throw new Error("revision retry failed");
    return ((data as { outcome?: RetryOutcome } | null)?.outcome ?? "not_found") as RetryOutcome;
  },
  async settleStale(id, lease, reason) {
    const db = await admin();
    const { data, error } = await db.rpc("settle_stale_revision" as never, { _id: id, _lease: lease, _reason: reason } as never);
    if (error) throw new Error("revision settle failed");
    return data === true;
  },
};
