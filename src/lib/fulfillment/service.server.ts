import { PersonaIdSchema, type PersonaId } from "../roast-personas";
import type { DeliveredRoast } from "../roast-delivery";
import { verifyRoastReceipt } from "../roast-receipt.server";
/** Production wiring of the fulfillment engine (Supabase + Stripe + Lovable AI). Server-only. */
import { getTier, type TierId } from "../products";
import {
  addClarification, confirmPayment, processOrder, retryFailed, settleStale,
  type OrderRow, type StripeSessionView,
} from "./engine";
import { extractDocumentText } from "./extract.server";
import { orderByToken, revisionRepo, supabaseRepo } from "./repo.server";
import { buildSnapshotSource } from "./snapshot";
import { liveModels, liveRevisionModels, makeLiveModels } from "./writer.server";
import {
  answerRevision, minorRevisionState, processRevision, requestRevision, retryRevision, settleStaleRevision,
  MAX_REVISION_RETRIES, type RevisionKind, type RevisionRow,
} from "./revision";
import { DELIVERY_WINDOW_HOURS, addEligibleHours, minorRevisionWindowEnd } from "./service-time";
import { RESUME_TEMPLATES } from "../resume-templates";
import { originalRoastForDelivery } from "./roast-delivery";
import { assertPurchaseSelection, recoveredPurchaseSelection } from "./purchase-selection";
import { deliverNotification, type NotificationKind, type NotificationState, type NotifyRepo } from "./notify";
import { RECOVERY_LIMITS, requestOrderLinks } from "./recovery";
import { marketingEmailPort, productionEmailPort } from "./email-transport.server";
import { PUBLIC_SITE_ORIGIN } from "../site";
import { livemodeMatches, modeOf, type StripeMode } from "./stripe-mode";
import { acquireProbe, breakerState, checkoutAvailability, finishProbe, flushOwnerAlerts, raiseIncidentAlert } from "../ops/ops.server";
import type { ProbeCtx } from "../ops/guard";

const BUCKET = "intake-uploads";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getSession(id: string, mode: StripeMode): Promise<StripeSessionView> {
  const { getCheckoutSession } = await import("../stripe.server");
  return (await getCheckoutSession(id, mode)) as unknown as StripeSessionView;
}

/** Re-read a session with the order's own Stripe mode/key. */
function confirm(o: OrderRow) {
  return confirmPayment(supabaseRepo, (id) => getSession(id, modeOf(o)), o);
}

async function readStored(path: string, filename: string): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const db = await admin();
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) return { ok: false, reason: "We couldn't open your uploaded file." };
  return extractDocumentText(new Uint8Array(await data.arrayBuffer()), filename);
}

async function sha256(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Snapshot the submitted intake server-side (extracting file text now), create the
 * order row, then open a Stripe session bound to it. Nothing from the browser except
 * the intake id, template and optional photo is trusted.
 */
export async function createOrderCheckout(input: { intakeId: string; template: string; photo?: string | undefined; origin: string; mode: StripeMode; roastPersona?: PersonaId | undefined; roastReceipt?: string | undefined; roastOwner?: string | undefined; followupOptIn?: boolean | undefined }) {
  const roastPersona = input.roastPersona === undefined ? undefined : PersonaIdSchema.parse(input.roastPersona);
  // Fail closed before saving anything new: no payment unless the package can actually be prepared.
  const health = await checkoutAvailability();
  if (!health.ok) throw new Error(health.message);
  const layout = RESUME_TEMPLATES.find((t) => t.id === input.template);
  if (!layout) throw new Error("Choose one of the available layouts.");
  if (layout.usesPhoto && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.photo ?? "")) throw new Error("Confirm a valid photo for this layout before paying.");
  const db = await admin();
  const { data: intake } = await db.from("intakes" as never).select("*").eq("id", input.intakeId).maybeSingle();
  const row = intake as null | {
    id: string; tier: TierId; confirmed: boolean; answers: Record<string, unknown>; created_at: string;
    resume_path: string | null; resume_filename: string | null; job_file_path: string | null; job_file_filename: string | null;
    job_description: string | null;
  };
  if (!row || !row.confirmed) throw new Error("We couldn't find your submitted intake. Please submit it again.");
  if (Date.now() - new Date(row.created_at).getTime() > 24 * 3600_000) throw new Error("This intake is over a day old. Please submit it again.");

  const { data: existing } = await db.from("fulfillment_orders" as never).select("*").eq("intake_id", row.id).gt("expires_at", new Date().toISOString()).maybeSingle();
  const ex = existing as OrderRow | null;
  if (ex && ex.status !== "awaiting_payment") return { already: true as const, token: ex.access_token };
  if (ex && modeOf(ex) !== input.mode) throw new Error("This order was started elsewhere. Reopen it from its order page.");

  let order = ex;
  if (!order) {
    let extracted: string | null = null;
    if (row.tier !== "scratch") {
      if (!row.resume_path || !row.resume_filename) throw new Error("Upload your current résumé.");
      const r = await readStored(row.resume_path, row.resume_filename);
      if (!r.ok) throw new Error(`${r.reason} Please upload a text-based PDF or DOCX before paying.`);
      extracted = r.text;
    }
    let jobText: string | null = null;
    if (row.tier === "bundle") {
      const parts = [row.job_description ?? ""];
      if (row.job_file_path && row.job_file_filename) {
        const j = await readStored(row.job_file_path, row.job_file_filename);
        if (!j.ok) throw new Error(`Job posting file: ${j.reason}`);
        parts.push(j.text);
      }
      jobText = parts.filter((p) => p.trim()).join("\n\n");
      if (jobText.trim().split(/\s+/).length < 40) throw new Error("Paste the full job description (or upload the posting) before paying.");
    }
    const { snapshot, sourceText } = buildSnapshotSource(row.tier, row.answers, extracted, row.resume_filename ?? "your intake answers");
    if (sourceText.length > 40_000) throw new Error("Your résumé is too long for us to process in full. Please shorten it to under ~6 pages.");
    if (roastPersona) snapshot.roastPersona = roastPersona;
    // Signed original roast only: never trust a browser grade or regenerate it in a new voice.
    if (input.roastReceipt) snapshot.originalRoast = await verifyRoastReceipt(input.roastReceipt, input.roastOwner, roastPersona);
    const photo = layout.usesPhoto ? input.photo ?? null : null;
    const { data: created, error } = await db.from("fulfillment_orders" as never).insert({
      intake_id: row.id, tier: row.tier, email: snapshot.email, template: input.template,
      snapshot, source_text: sourceText, job_text: jobText, source_sha256: await sha256(sourceText + "\n" + (jobText ?? "")), photo,
      stripe_mode: input.mode,
      // Optional commercial follow-up consent; default off, never required to purchase, never for test orders.
      followup_opt_in: input.followupOptIn === true && input.mode === "live",
      ...(input.followupOptIn === true && input.mode === "live" ? { followup_opt_in_at: new Date().toISOString() } : {}),
    } as never).select("*").single();
    if (error?.code === "23505") {
      const { data: raced } = await db.from("fulfillment_orders" as never).select("*").eq("intake_id", row.id).gt("expires_at", new Date().toISOString()).maybeSingle();
      order = raced as OrderRow | null;
    } else if (error || !created) throw new Error("We couldn't save your order. Try again.");
    else order = created as OrderRow;
  }
  if (!order) throw new Error("We couldn't save your order. Try again.");
  // Also checks the winning snapshot after a concurrent insert. Never change a
  // selection while another tab may create or pay an existing Stripe session.
  assertPurchaseSelection({ ...order, roastPersona: order.snapshot.roastPersona }, { template: input.template, photo: layout.usesPhoto ? input.photo ?? null : null, roastPersona });
  return checkoutForOrder(order, input.origin);
}

async function checkoutForOrder(order: OrderRow, origin: string) {
  const db = await admin();
  const { createCheckoutSession, getCheckoutSession } = await import("../stripe.server");
  if (order.status !== "awaiting_payment") return { already: true as const, token: order.access_token };
  const health = await checkoutAvailability();
  if (!health.ok) {
    // Close an unpaid open session so it can't be paid during a known outage. Paid/complete is never touched.
    if (order.stripe_session_id) {
      const prev = await getCheckoutSession(order.stripe_session_id, modeOf(order));
      if (prev.payment_status === "paid" || prev.status === "complete") return { already: true as const, token: order.access_token };
      if (prev.status === "open") {
        const { expireCheckoutSession } = await import("../stripe.server");
        await expireCheckoutSession(order.stripe_session_id, modeOf(order)).catch(() => undefined);
      }
    }
    throw new Error(health.message);
  }
  let attempt = order.checkout_attempt ?? 0;
  if (order.stripe_session_id) {
    const prev = await getCheckoutSession(order.stripe_session_id, modeOf(order));
    if (prev.payment_status === "paid" || prev.status === "complete") return { already: true as const, token: order.access_token };
    if (prev.status === "open" && prev.url) return { already: false as const, token: order.access_token, url: prev.url };
    if (prev.status !== "expired") throw new Error("Stripe is still confirming this checkout. Try again shortly.");
    attempt += 1;
  }
  const s = await createCheckoutSession({
    tier: order.tier, email: order.email, origin, mode: modeOf(order),
    orderId: order.id, successPath: `/orders/${order.access_token}`, checkoutAttempt: attempt,
  });
  let query = db.from("fulfillment_orders" as never).update({ stripe_session_id: s.id, checkout_attempt: attempt } as never).eq("id", order.id).eq("status", "awaiting_payment").eq("checkout_attempt", order.checkout_attempt ?? 0);
  query = order.stripe_session_id ? query.eq("stripe_session_id", order.stripe_session_id) : query.is("stripe_session_id", null);
  const { data: linked, error } = await query.select("id").maybeSingle();
  if (error) throw new Error("Checkout couldn't be linked. Try again; your saved order is safe.");
  if (!linked) {
    const latest = await supabaseRepo.byId(order.id);
    if (!latest || latest.stripe_session_id !== s.id) throw new Error("Your checkout changed. Reopen your order page.");
  }
  if (!s.url) throw new Error("Checkout couldn't start. Try again.");
  // Race recheck: an outage may have opened while this session was being created. Close it before handing it out.
  const after = await checkoutAvailability();
  if (!after.ok) {
    const { expireCheckoutSession } = await import("../stripe.server");
    await expireCheckoutSession(s.id, modeOf(order)).catch(() => console.error("post-create expire failed", { orderId: order.id }));
    throw new Error(after.message);
  }
  return { already: false as const, token: order.access_token, url: s.url };
}

export async function resumeCheckout(token: string, origin: string) {
  const order = await orderByToken(token);
  if (!order) throw new Error("This order link has expired.");
  return checkoutForOrder(order, origin);
}

/**
 * Only an UNPAID order resumes into checkout. A paid/finished order is offered as a
 * link, never forced, so repeat customers can always start a new order.
 */
export async function recoverProgress(tier?: TierId, intakeId?: string, token?: string) {
  let previous: { token: string; tier: TierId } | null = null;
  if (token) {
    const order = await orderByToken(token);
    if (order && order.status !== "awaiting_payment") previous = { token: order.access_token, tier: order.tier };
    else if (order && (!tier || order.tier === tier)) {
      const { data } = await (await admin()).from("fulfillment_orders" as never).select("intake_id").eq("id", order.id).maybeSingle();
      const saved = data as { intake_id: string } | null;
      return { intakeId: saved?.intake_id ?? null, token: order.access_token, tier: order.tier, previous: null, selection: recoveredPurchaseSelection(order) };
    }
  }
  if (!tier || !intakeId || !/^[0-9a-f-]{36}$/i.test(intakeId)) return previous ? { intakeId: null, token: null, tier, previous } : null;
  const db = await admin();
  const { data } = await db.from("intakes" as never).select("id,tier").eq("id", intakeId).eq("tier", tier).gt("created_at", new Date(Date.now() - 86400000).toISOString()).maybeSingle();
  if (!data) return previous ? { intakeId: null, token: null, tier, previous } : null;
  const { data: saved } = await db.from("fulfillment_orders" as never).select("access_token,status,template,photo,snapshot").eq("intake_id", intakeId).gt("expires_at", new Date().toISOString()).maybeSingle();
  const s = saved as { access_token: string; status: string; template: string; photo: string | null; snapshot: OrderRow["snapshot"] } | null;
  if (s && s.status !== "awaiting_payment") return { intakeId: null, token: null, tier, previous: previous ?? { token: s.access_token, tier } };
  return { intakeId, token: s?.access_token ?? null, tier, previous, ...(s ? { selection: recoveredPurchaseSelection(s) } : {}) };
}

export type PublicStatus = {
  roastPersona?: PersonaId;
  originalRoast?: DeliveredRoast;
  status: OrderRow["status"];
  tier: TierId;
  name: string;
  questions: string[];
  failureReason: string | null;
  canRetry: boolean;
  files: Array<{ kind: string; label: string; href: string }>;
  keywordReport?: NonNullable<OrderRow["result"]>["keywordReport"];
  checks?: NonNullable<OrderRow["result"]>["checks"];
  /** True only after the managed sender accepted the "ready" email. */
  emailed: boolean;
  emailActive: boolean;
  followupOptIn: boolean;
  /** Stripe test-mode order: no real charge, no customer email. */
  testMode: boolean;
  paidAt: string | null;
  expiresAt: string | null;
  /** When files first became available (starts the minor-revision window). */
  deliveredAt: string | null;
  /** Latest promised initial delivery (48 eligible hours, Sundays excluded) while not yet delivered. */
  deliveryDeadline: string | null;
  minorRevision: "available" | "pending" | "used" | "closed" | "n/a";
  minorWindowEnd: string | null;
  revisions: PublicRevision[];
  /** One-off customer notice from the last action (e.g. why a retry was refused). */
  notice?: string;
};

export type PublicRevision = {
  id: string; kind: RevisionKind; status: RevisionRow["status"]; requestedAt: string; deadlineAt: string;
  completedAt: string | null; version: number | null; question: string | null; reason: string | null; canRetry: boolean;
  files: Array<{ kind: string; label: string; href: string }>;
};

function fileList(base: string, hasLetter: boolean, q = "") {
  return [
    { kind: "resume-docx", label: "Résumé (Word, editable)", href: `${base}/resume.docx${q}` },
    { kind: "resume-html", label: "Résumé (styled, print to PDF)", href: `${base}/resume.html${q}` },
    ...(hasLetter
      ? [
          { kind: "letter-docx", label: "Cover letter (Word, editable)", href: `${base}/cover-letter.docx${q}` },
          { kind: "letter-html", label: "Cover letter (styled, print to PDF)", href: `${base}/cover-letter.html${q}` },
        ]
      : []),
  ];
}

function deliveryStart(o: OrderRow): string | null {
  if (!o.paid_at) return null;
  const last = o.clarifications.at(-1)?.at;
  return last && last > o.paid_at ? last : o.paid_at;
}

function toPublic(o: OrderRow, revisions: RevisionRow[] = []): PublicStatus {
  const base = `/api/public/order-file/${o.access_token}`;
  const files = o.status === "ready" && o.result ? fileList(base, Boolean(o.result.coverLetter)) : [];
  const start = deliveryStart(o);
  const ready = o.status === "ready" && Boolean(o.result);
  const originalRoast = originalRoastForDelivery(o);
  return {
    status: o.status, tier: o.tier, name: o.snapshot.name.split(/\s+/)[0] ?? "",
    questions: o.status === "needs_information" ? (o.clarification_request?.questions ?? []) : [],
    failureReason: o.status === "failed" ? o.failure_reason : null,
    canRetry: o.status === "failed" && o.retry_rounds < 2,
    files,
    ...(o.snapshot.roastPersona ? { roastPersona: o.snapshot.roastPersona } : {}),
    ...(originalRoast ? { originalRoast } : {}),
    ...(o.status === "ready" && o.result?.keywordReport ? { keywordReport: o.result.keywordReport } : {}),
    ...(o.status === "ready" && o.result ? { checks: o.result.checks } : {}),
    emailed: ((o as OrderRow & { notifications?: Record<string, NotificationState> }).notifications?.["ready"]?.outcome) === "sent",
    emailActive: modeOf(o) === "live" && productionEmailPort.available(),
    followupOptIn: (o as OrderRow & { followup_opt_in?: boolean }).followup_opt_in === true && !(o as OrderRow & { followup_unsubscribed_at?: string | null }).followup_unsubscribed_at,
    testMode: modeOf(o) === "test",
    paidAt: o.paid_at, expiresAt: o.expires_at ?? null,
    deliveredAt: o.delivered_at ?? null,
    deliveryDeadline: !ready && start && o.status !== "needs_information" ? addEligibleHours(start, DELIVERY_WINDOW_HOURS.max).toISOString() : null,
    minorRevision: ready && o.delivered_at ? minorRevisionState(o, revisions) : "n/a",
    minorWindowEnd: o.delivered_at ? minorRevisionWindowEnd(o.delivered_at).toISOString() : null,
    revisions: ready ? revisions.map((r) => ({
      id: r.id, kind: r.kind, status: r.status, requestedAt: r.requested_at, deadlineAt: r.deadline_at, completedAt: r.completed_at,
      version: r.version, question: r.status === "needs_information" ? r.clarification_request : null,
      reason: r.status === "failed" || r.status === "rejected" ? r.failure_reason : null,
      canRetry: r.status === "failed" && r.retry_rounds < MAX_REVISION_RETRIES
        && !revisions.some((x) => x.id !== r.id && ["queued", "processing", "needs_information"].includes(x.status))
        && !(r.kind === "minor" && revisions.some((x) => x.kind === "minor" && x.status === "ready")),
      files: r.status === "ready" && r.result ? fileList(base, Boolean(r.result.coverLetter), `?v=${r.id}`) : [],
    })) : [],
  };
}

async function revisionsFor(o: OrderRow): Promise<RevisionRow[]> {
  if (o.status !== "ready") return [];
  const list = await revisionRepo.forOrder(o.id);
  return Promise.all(list.map((r) => settleStaleRevision(revisionRepo, r)));
}

/** Status read: confirms payment with Stripe if needed and settles dead leases. */
export async function statusByToken(token: string): Promise<PublicStatus | null> {
  let o = await orderByToken(token);
  if (!o) return null;
  o = await confirm(o);
  o = await settleStale(supabaseRepo, o);
  return toPublic(o, await revisionsFor(o));
}

/** Customer revision request. Reservation is atomic; nothing is consumed until a validated revision completes. */
export async function requestRevisionByToken(token: string, kind: RevisionKind, text: string, idem: string) {
  const o = await orderByToken(token);
  if (!o) return { ok: false as const, message: "This order link has expired.", status: null };
  const r = await requestRevision(revisionRepo, o, kind, text, idem);
  return { ...(r.ok ? { ok: true as const, message: "Request received." } : { ok: false as const, message: r.message }), status: await statusByToken(token) };
}

async function ownedRevision(token: string, id: string) {
  const o = await orderByToken(token);
  if (!o) return null;
  const r = await revisionRepo.byId(id);
  return r && r.order_id === o.id ? r : null;
}

export async function answerRevisionByToken(token: string, id: string, text: string) {
  const r = await ownedRevision(token, id);
  if (r) await answerRevision(revisionRepo, r, text);
  return statusByToken(token);
}

export async function retryRevisionByToken(token: string, id: string) {
  const r = await ownedRevision(token, id);
  const res = r ? await retryRevision(revisionRepo, r) : null;
  const status = await statusByToken(token);
  return status && res && !res.ok ? { ...status, notice: res.message } : status;
}

/**
 * Browser nudge: status read only. Paid generation never runs inside a page-attached request —
 * a closed tab or navigation cancels that request (and its in-flight model call), stranding the
 * lease. The scheduled worker (every 2 minutes) owns all processing.
 */
export async function runRevisionByToken(token: string, id: string) {
  await ownedRevision(token, id);
  return statusByToken(token);
}

/** Browser nudge: status read only; the scheduled worker processes due orders. */
export async function runByToken(token: string): Promise<PublicStatus | null> {
  const o = await orderByToken(token);
  if (!o) return null;
  return statusByToken(token);
}

export async function clarifyByToken(token: string, text: string) {
  const o = await orderByToken(token);
  if (!o) return null;
  await addClarification(supabaseRepo, o, text);
  return statusByToken(token);
}

export async function retryByToken(token: string) {
  const o = await orderByToken(token);
  if (!o) return null;
  await retryFailed(supabaseRepo, o);
  return statusByToken(token);
}

/** Webhook entry: idempotent per event id; verifies the session with Stripe again. */
export async function handleStripeEvent(evt: { id: string; type: string; livemode?: boolean; data?: { object?: { id?: string } } }, mode: StripeMode) {
  // Each route accepts only its own mode's events; a test event never touches a live order.
  if (!livemodeMatches(mode, evt.livemode)) return "mode_mismatch";
  const db = await admin();
  const { error } = await db.from("stripe_events" as never).insert({ id: evt.id, type: evt.type, stripe_mode: mode } as never);
  if (error?.code === "23505") return "duplicate";
  if (error) throw new Error("event log failed");
  try {
    if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(evt.type)) return "ignored";
    const sid = evt.data?.object?.id;
    if (!sid) return "ignored";
    const o = await supabaseRepo.bySession(sid);
    if (!o) return "unknown_session";
    if (modeOf(o) !== mode) return "mode_mismatch";
    const after = await confirm(o);
    return after.status;
  } catch (e) {
    // Forget the event so Stripe's retry is processed instead of being treated as a duplicate.
    await db.from("stripe_events" as never).delete().eq("id", evt.id);
    throw e;
  }
}

export const notifyRepo: NotifyRepo = {
  byId: (id) => supabaseRepo.byId(id),
  async revision(orderId, revisionId) {
    const r = await revisionRepo.byId(revisionId);
    return r && r.order_id === orderId && r.version ? { id: r.id, version: r.version, status: r.status } : null;
  },
  async claim(id, kind) {
    const db = await admin();
    const { data, error } = await db.rpc("claim_notification_fenced" as never, { _order_id: id, _kind: kind, _lease_seconds: 120 } as never);
    if (error) throw new Error("notification claim failed");
    return typeof data === "string" ? data : null;
  },
  async finish(id, kind, token, patch) {
    const db = await admin();
    const { data, error } = await db.rpc("finish_notification_fenced" as never, { _order_id: id, _kind: kind, _token: token, _patch: patch } as never);
    if (error) throw new Error("notification update failed");
    return data === true;
  },
};

/** Sends due confirmation/ready emails (bounded). No-op until email delivery is active. */
export async function sweepNotifications(limit = 10) {
  if (!productionEmailPort.available()) return [] as string[];
  const db = await admin();
  const { data } = await db.rpc("due_notifications" as never, { _limit: limit } as never);
  const { data: revs } = await db.rpc("due_revision_notifications" as never, { _limit: limit } as never);
  const out: string[] = [];
  for (const r of [...((data ?? []) as Array<{ order_id: string; kind: NotificationKind }>), ...((revs ?? []) as Array<{ order_id: string; kind: NotificationKind }>)]) {
    // Test-mode orders never send customer email.
    const o = await supabaseRepo.byId(r.order_id);
    if (!o || modeOf(o) === "test") continue;
    out.push(await deliverNotification(notifyRepo, productionEmailPort, r.order_id, r.kind, PUBLIC_SITE_ORIGIN).catch(() => "retry" as const));
  }
  // Opt-in commercial follow-ups use their own (currently disabled) port; never the app-email sender.
  if (marketingEmailPort.available()) {
    const { data: fu } = await db.rpc("due_followups" as never, { _limit: limit } as never);
    for (const r of (fu ?? []) as Array<{ order_id: string; kind: NotificationKind }>) {
      out.push(await deliverNotification(notifyRepo, marketingEmailPort, r.order_id, r.kind, PUBLIC_SITE_ORIGIN).catch(() => "retry" as const));
    }
  }
  return out;
}

async function hashId(v: string) {
  return sha256(`kcs-recovery-v1:${v}`);
}

export async function recoverOrderLinks(email: string, ip: string) {
  const db = await admin();
  return requestOrderLinks(email, ip, {
    hash: hashId,
    async admit(eh, ih) {
      const { data, error } = await db.rpc("admit_recovery_request" as never, {
        _email_hash: eh, _ip_hash: ih, _per_email: RECOVERY_LIMITS.perEmailPerHour, _per_ip: RECOVERY_LIMITS.perIpPerHour,
      } as never);
      if (error) throw new Error("recovery admission failed");
      return data === true;
    },
    async ordersFor(e) {
      const { data, error } = await db.from("fulfillment_orders" as never).select("access_token,tier,status")
        .ilike("email", e.replace(/[\\%_]/g, (c) => `\\${c}`)).eq("stripe_mode", "live").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(5);
      if (error) throw new Error("recovery lookup failed");
      return (data ?? []) as Array<{ access_token: string; tier: string; status: string }>;
    },
    port: productionEmailPort,
    origin: PUBLIC_SITE_ORIGIN,
  });
}

export function emailDeliveryActive() {
  return productionEmailPort.available();
}

/**
 * Persistent failure scan: settles dead final-attempt leases, then raises one owner alert per
 * failed order/revision round — whether it failed in the worker, a browser nudge, or a stale lease.
 */
export async function scanFailures(limit = 50) {
  const db = await admin();
  const now = new Date().toISOString();
  const { data: staleOrders, error: e1 } = await db.from("fulfillment_orders" as never).select("*")
    .eq("status", "processing").lt("locked_until", now).limit(limit);
  if (e1) throw new Error("stale order scan failed");
  for (const o of (staleOrders ?? []) as OrderRow[]) if (o.attempts >= o.max_attempts) await settleStale(supabaseRepo, o);
  const { data: staleRevs, error: e2 } = await db.from("order_revisions" as never).select("*")
    .eq("status", "processing").lt("locked_until", now).limit(limit);
  if (e2) throw new Error("stale revision scan failed");
  for (const r of (staleRevs ?? []) as RevisionRow[]) await settleStaleRevision(revisionRepo, r);

  const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
  const { data: failed, error: e3 } = await db.from("fulfillment_orders" as never).select("id,retry_rounds,stripe_mode")
    .eq("status", "failed").gt("updated_at", since).order("updated_at", { ascending: false }).limit(limit);
  if (e3) throw new Error("failed order scan failed");
  let raised = 0;
  for (const o of (failed ?? []) as Array<{ id: string; retry_rounds: number; stripe_mode: string }>) {
    if (await raiseIncidentAlert(`order-failed-${o.id}-r${o.retry_rounds}`, `A paid${o.stripe_mode === "test" ? " TEST-mode" : ""} order (internal id ${o.id}) could not be completed after all automatic attempts. The customer can retry from their order page without paying again; review it if retries also fail.`)) raised++;
  }
  const { data: failedRevs, error: e4 } = await db.from("order_revisions" as never).select("id,order_id,retry_rounds")
    .eq("status", "failed").gt("updated_at", since).order("updated_at", { ascending: false }).limit(limit);
  if (e4) throw new Error("failed revision scan failed");
  for (const r of (failedRevs ?? []) as Array<{ id: string; order_id: string; retry_rounds: number }>) {
    if (await raiseIncidentAlert(`revision-failed-${r.id}-r${r.retry_rounds}`, `A revision request (internal id ${r.id}, order ${r.order_id}) could not be completed after all automatic attempts. The customer's delivered files are unchanged; they can retry from their order page.`)) raised++;
  }
  return raised;
}

/** Background sweep: confirm pending payments, process due orders, scan failures, then send due emails. Throws if a core step fails. */
export async function sweep(limit = 2) {
  const db = await admin();
  const { data: pending } = await db.from("fulfillment_orders" as never).select("*")
    .eq("status", "awaiting_payment").not("stripe_session_id", "is", null)
    .gt("created_at", new Date(Date.now() - 2 * 24 * 3600_000).toISOString()).limit(10);
  for (const o of (pending ?? []) as OrderRow[]) await confirm(o).catch(() => undefined);
  // Known outage: queued paid orders wait (no attempts burned). After the cooldown one due order owns the probe;
  // a probe is acquired only when there is real work to send.
  const gate = await breakerState();
  const ctx: ProbeCtx = {};
  let ids: string[] = [];
  if (gate === "closed") ids = await supabaseRepo.due(limit);
  else if (gate === "probe_ready") {
    const candidate = await supabaseRepo.due(1);
    if (candidate.length) {
      ctx.probe = (await acquireProbe()) ?? undefined;
      if (ctx.probe) ids = candidate;
    }
  }
  const results: string[] = [];
  try {
    const models = ctx.probe ? makeLiveModels(ctx) : liveModels;
    for (const id of ids) {
      const r = await processOrder(supabaseRepo, models, id);
      results.push(r);
      if (r === "paused") break;
    }
  } finally {
    await finishProbe(ctx);
  }
  const { data: revIds } = gate === "closed" && !results.includes("paused")
    ? await db.rpc("due_revisions" as never, { _limit: limit } as never)
    : { data: [] as unknown[] };
  const revisions: string[] = [];
  for (const r of (revIds ?? []) as unknown[]) {
    const rid = typeof r === "string" ? r : (r as { due_revisions: string }).due_revisions;
    const out = await processRevision(revisionRepo, liveRevisionModels, rid).catch(() => "error");
    revisions.push(out);
    if (out === "paused") break;
  }
  const alerts = await scanFailures();
  const emails = await sweepNotifications(10).catch(() => [] as string[]);
  await flushOwnerAlerts().catch(() => undefined);
  return { gate, confirmed: (pending ?? []).length, processed: results, revisions, emails, alerts };
}

// ---- Optional follow-up consent (default off) and private feedback ----
type ConsentRow = { id: string; stripe_mode: string; paid_at: string | null; followup_opt_in: boolean; followup_unsubscribed_at: string | null; tier: string; status: string };

/** Order page (private access token). Only paid live orders can opt in; test orders never get follow-ups. */
export async function setFollowupConsentByToken(token: string, optIn: boolean) {
  const db = await admin();
  const { data } = await db.from("fulfillment_orders" as never).select("id,stripe_mode,paid_at").eq("access_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  const o = data as Pick<ConsentRow, "id" | "stripe_mode" | "paid_at"> | null;
  if (!o) return { ok: false as const, reason: "not_found" };
  if (o.stripe_mode !== "live" || !o.paid_at) return { ok: false as const, reason: "not_eligible" };
  await writeConsent(o.id, optIn);
  return { ok: true as const, optIn };
}

async function writeConsent(id: string, optIn: boolean) {
  const db = await admin();
  const now = new Date().toISOString();
  const patch = optIn ? { followup_opt_in: true, followup_opt_in_at: now, followup_unsubscribed_at: null } : { followup_opt_in: false, followup_unsubscribed_at: now };
  const { error } = await db.from("fulfillment_orders" as never).update(patch as never).eq("id", id);
  if (error) throw new Error("consent update failed");
}

async function byPref(pref: string) {
  const db = await admin();
  const { data } = await db.from("fulfillment_orders" as never).select("id,stripe_mode,paid_at,followup_opt_in,followup_unsubscribed_at,tier,status").eq("pref_token", pref).maybeSingle();
  return data as ConsentRow | null;
}

/** Email preference page (separate pref token): no PII, no order contents, no file access. */
export async function preferencesByPref(pref: string) {
  const o = await byPref(pref);
  if (!o) return null;
  const db = await admin();
  const { data: fb } = await db.from("order_feedback" as never).select("rating").eq("order_id", o.id).maybeSingle();
  return { optedIn: o.followup_opt_in && !o.followup_unsubscribed_at, packageName: getTier(o.tier)?.name ?? "your package", feedbackGiven: Boolean(fb), canGiveFeedback: o.status === "ready" && o.stripe_mode === "live" && Boolean(o.paid_at) };
}

export async function updatePreferencesByPref(pref: string, optIn: boolean) {
  const o = await byPref(pref);
  if (!o) return { ok: false as const };
  if (optIn && (o.stripe_mode !== "live" || !o.paid_at)) return { ok: false as const };
  await writeConsent(o.id, optIn);
  return { ok: true as const, optIn };
}

export async function submitFeedbackByPref(pref: string, input: { rating: number; comment?: string | undefined; shareOk: boolean }) {
  const o = await byPref(pref);
  if (!o || o.status !== "ready" || o.stripe_mode !== "live" || !o.paid_at) return { ok: false as const };
  const db = await admin();
  const { error } = await db.from("order_feedback" as never).upsert({ order_id: o.id, rating: input.rating, comment: input.comment?.trim() || null, share_ok: input.shareOk, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error("feedback save failed");
  return { ok: true as const };
}
