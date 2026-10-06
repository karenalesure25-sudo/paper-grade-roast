/**
 * Fulfillment state machine. I/O is injected (repo, Stripe reader, models) so the
 * exact production logic is exercised by tests with isolated fakes.
 *
 * awaiting_payment → queued → processing → ready
 *                                       ↘ needs_information → (customer answers) → queued
 *                                       ↘ queued (bounded retry) → failed → (customer retry, bounded) → queued
 *
 * Every write made by a worker after its claim is fenced by the lease id it was
 * issued, so a worker whose lease expired can never overwrite a newer worker.
 */
import type { TierId } from "../products";
import {
  buildKeywordReport, missingEssentials, validatePackage,
  type FullResume, type KeywordReport, type Package, type SourceFacts, type Violation,
} from "./validate";
import type { ModelPort } from "./writer.server";

export const TIER_CENTS: Record<TierId, number> = { revamp: 4000, scratch: 5000, bundle: 6000 };
export const MAX_GENERATIONS_PER_ATTEMPT = 3;
export const MAX_CUSTOMER_RETRIES = 2;
export const LEASE_SECONDS = 600;

export type OrderStatus = "awaiting_payment" | "queued" | "processing" | "needs_information" | "ready" | "failed";

export type OrderRow = {
  id: string;
  access_token: string;
  tier: TierId;
  email: string;
  template: string;
  photo?: string | null;
  snapshot: Snapshot;
  source_text: string;
  job_text: string | null;
  stripe_session_id: string | null;
  checkout_attempt?: number;
  status: OrderStatus;
  attempts: number;
  max_attempts: number;
  retry_rounds: number;
  locked_until: string | null;
  lease_id?: string | null;
  paid_at: string | null;
  clarification_request: { questions: string[] } | null;
  clarifications: Array<{ at: string; text: string }>;
  result: DeliveredPackage | null;
  failure_reason: string | null;
  expires_at?: string;
};

export type Snapshot = {
  name: string;
  email: string;
  phone: string;
  targetJobTitle?: string;
  companyName?: string;
  specificJobTitle?: string;
  requiredEmployers: string[];
  requiredSchools: string[];
  requiredCertifications: string[];
  additionalInfo?: string;
  sourceLabel: string;
};

export type DeliveredPackage = {
  resume: FullResume;
  coverLetter?: string;
  keywordReport?: KeywordReport;
  validatedAt: string;
  checks: { deterministic: "passed"; independent: "passed"; exports: "passed"; generations: number };
};

export type StripeSessionView = {
  id: string;
  mode: string;
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  currency_conversion?: { amount_total: number; source_currency: string } | null;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
};

export type Repo = {
  byId(id: string): Promise<OrderRow | null>;
  bySession(sessionId: string): Promise<OrderRow | null>;
  /** Conditional update: applies only if current status is in `from`. Returns updated row or null. */
  transition(id: string, from: OrderStatus[], patch: Partial<OrderRow>): Promise<OrderRow | null>;
  /** Lease-fenced update: applies only while status=processing AND lease_id matches. */
  finish(id: string, leaseId: string, patch: Partial<OrderRow>): Promise<OrderRow | null>;
  /** Extends the lease; false when the lease was lost. */
  renew(id: string, leaseId: string): Promise<boolean>;
  /** Atomic leased claim. Null when another worker holds it or nothing is due. */
  claim(id: string): Promise<OrderRow | null>;
  due(limit: number): Promise<string[]>;
  /** Idempotent upsert. Must throw on failure (never silently drops). */
  recordRedemption(sessionId: string, tier: TierId, email: string, status: "building" | "delivered" | "failed"): Promise<void>;
};

/** Pure: does this Stripe session pay for exactly this order? */
export function sessionPaysOrder(order: Pick<OrderRow, "id" | "tier" | "email" | "stripe_session_id">, s: StripeSessionView): { ok: true } | { ok: false; reason: string } {
  if (!order.stripe_session_id || s.id !== order.stripe_session_id) return { ok: false, reason: "session_mismatch" };
  if (s.mode !== "payment" || s.status !== "complete" || s.payment_status !== "paid") return { ok: false, reason: "unpaid" };
  const usd = s.currency_conversion?.source_currency === "usd" ? s.currency_conversion.amount_total : s.currency === "usd" ? s.amount_total : null;
  if (usd !== TIER_CENTS[order.tier]) return { ok: false, reason: "amount_mismatch" };
  const m = s.metadata ?? {};
  if (m["order_id"] !== order.id || s.client_reference_id !== order.id) return { ok: false, reason: "order_mismatch" };
  if (m["tier"] !== order.tier) return { ok: false, reason: "tier_mismatch" };
  if ((m["email"] ?? "").toLowerCase() !== order.email.toLowerCase()) return { ok: false, reason: "email_mismatch" };
  return { ok: true };
}

/** Verify payment with Stripe (server-side) and queue the order exactly once. Idempotent. */
export async function confirmPayment(repo: Repo, getSession: (id: string) => Promise<StripeSessionView>, order: OrderRow): Promise<OrderRow> {
  if (order.status !== "awaiting_payment" || !order.stripe_session_id) return order;
  const s = await getSession(order.stripe_session_id);
  const v = sessionPaysOrder(order, s);
  if (!v.ok) return order;
  // Record first (idempotent): if this throws, nothing has advanced and the caller retries.
  await repo.recordRedemption(order.stripe_session_id, order.tier, order.email, "building");
  const updated = await repo.transition(order.id, ["awaiting_payment"], { status: "queued", paid_at: new Date().toISOString() });
  return updated ?? (await repo.byId(order.id)) ?? order;
}

export function factsFor(order: Pick<OrderRow, "tier" | "snapshot" | "source_text" | "job_text" | "clarifications">): SourceFacts {
  const sn = order.snapshot;
  const clar = order.clarifications.map((c) => c.text).join("\n");
  return {
    tier: order.tier,
    text: [order.source_text, clar ? `Customer clarifications:\n${clar}` : ""].filter(Boolean).join("\n\n"),
    name: sn.name,
    email: sn.email,
    phone: sn.phone,
    ...(order.tier === "scratch" && sn.targetJobTitle ? { targetTitle: sn.targetJobTitle } : {}),
    requiredEmployers: sn.requiredEmployers,
    requiredSchools: sn.requiredSchools,
    requiredCertifications: sn.requiredCertifications,
    ...(order.tier === "bundle"
      ? { job: { text: order.job_text ?? "", company: sn.companyName ?? "", title: sn.specificJobTitle ?? "" } }
      : {}),
  };
}

export type GenerationOutcome =
  | { kind: "ready"; pkg: DeliveredPackage }
  | { kind: "needs_information"; questions: string[] }
  | { kind: "rejected"; violations: Violation[] };

/** Checks the rendered deliverables (HTML/DOCX) still contain every validated field. */
export type ExportCheck = (pkg: Package) => Promise<Violation[]>;

/** Generate + validate with bounded correction. Never returns an unvalidated package. */
export async function generateValidated(
  facts: SourceFacts,
  models: ModelPort,
  opts: { exportCheck?: ExportCheck; beforeCall?: () => Promise<void> } = {},
): Promise<GenerationOutcome> {
  const pre = missingEssentials(facts);
  if (pre.length) return { kind: "needs_information", questions: pre };
  const beat = opts.beforeCall ?? (async () => undefined);
  let feedback: Violation[] = [];
  for (let g = 1; g <= MAX_GENERATIONS_PER_ATTEMPT; g++) {
    await beat();
    const out = await models.write(facts, feedback);
    if (out.kind === "needs_information") return { kind: "needs_information", questions: out.questions };
    const resume: FullResume = { ...out.resume, name: facts.name, email: facts.email, phone: facts.phone };
    const keywordReport = facts.job ? buildKeywordReport(out.keywords, facts.job.text, facts.text, resume) : undefined;
    const pkg: Package = { resume, ...(out.coverLetter ? { coverLetter: out.coverLetter } : {}), ...(keywordReport ? { keywordReport } : {}) };
    const violations = validatePackage(pkg, facts);
    if (violations.length) { feedback = violations; continue; }
    await beat();
    const verdict = await models.check(facts, { resume, coverLetter: pkg.coverLetter });
    if (!verdict.approved) { feedback = verdict.problems.map((p) => ({ code: "fact_check", detail: p })); continue; }
    const exportProblems = opts.exportCheck ? await opts.exportCheck(pkg) : [];
    if (exportProblems.length) { feedback = exportProblems; continue; }
    return {
      kind: "ready",
      pkg: { ...pkg, validatedAt: new Date().toISOString(), checks: { deterministic: "passed", independent: "passed", exports: "passed", generations: g } },
    };
  }
  return { kind: "rejected", violations: feedback };
}

export class LeaseLost extends Error {
  constructor() { super("lease lost"); }
}

/** Claim and process one order. Safe to call concurrently and repeatedly. */
export async function processOrder(
  repo: Repo,
  models: ModelPort,
  orderId: string,
  opts: { exportCheck?: ExportCheck } = {},
): Promise<OrderStatus | "busy" | "lease_lost"> {
  const claimed = await repo.claim(orderId);
  if (!claimed) return "busy";
  const lease = claimed.lease_id;
  if (!lease) throw new Error("claim returned no lease");
  const beforeCall = async () => {
    if (!(await repo.renew(claimed.id, lease))) throw new LeaseLost();
  };
  let outcome: GenerationOutcome;
  try {
    outcome = await generateValidated(factsFor(claimed), models, { ...opts, beforeCall });
  } catch (e) {
    if (e instanceof LeaseLost) return "lease_lost";
    console.error("fulfillment attempt errored", { orderId });
    return finishFailedAttempt(repo, claimed, lease, "We hit a temporary problem writing your package.");
  }
  if (outcome.kind === "ready") {
    // Ledger first, then release: a ledger failure leaves the order processing and retryable.
    if (claimed.stripe_session_id) await repo.recordRedemption(claimed.stripe_session_id, claimed.tier, claimed.email, "delivered");
    const done = await repo.finish(claimed.id, lease, {
      status: "ready", result: outcome.pkg, locked_until: null, lease_id: null, failure_reason: null, clarification_request: null,
    });
    return done ? "ready" : "lease_lost";
  }
  if (outcome.kind === "needs_information") {
    const done = await repo.finish(claimed.id, lease, {
      status: "needs_information", clarification_request: { questions: outcome.questions }, locked_until: null, lease_id: null,
    });
    return done ? "needs_information" : "lease_lost";
  }
  console.error("fulfillment validation rejected", { orderId, codes: [...new Set(outcome.violations.map((v) => v.code))] });
  return finishFailedAttempt(repo, claimed, lease, "Our accuracy checks couldn't approve a version that uses only your facts.");
}

async function finishFailedAttempt(repo: Repo, order: OrderRow, lease: string, reason: string): Promise<OrderStatus | "lease_lost"> {
  const last = order.attempts >= order.max_attempts;
  const done = await repo.finish(order.id, lease, {
    status: last ? "failed" : "queued",
    locked_until: null,
    lease_id: null,
    failure_reason: reason,
  });
  if (!done) return "lease_lost";
  if (last && order.stripe_session_id) {
    await repo.recordRedemption(order.stripe_session_id, order.tier, order.email, "failed").catch(() =>
      console.error("redemption ledger update failed", { orderId: order.id }),
    );
  }
  return last ? "failed" : "queued";
}

/** Customer answers clarification questions (append-only) and the order is re-queued. */
export async function addClarification(repo: Repo, order: OrderRow, text: string): Promise<OrderRow | null> {
  const clean = text.trim();
  if (order.status !== "needs_information" || clean.length < 5 || clean.length > 6000) return null;
  if (order.clarifications.length >= 5) return null;
  return repo.transition(order.id, ["needs_information"], {
    status: "queued",
    attempts: 0,
    clarifications: [...order.clarifications, { at: new Date().toISOString(), text: clean }],
  });
}

/** A failed purchase is never consumed: the customer may re-run it a bounded number of times. */
export async function retryFailed(repo: Repo, order: OrderRow): Promise<OrderRow | null> {
  if (order.status !== "failed" || order.retry_rounds >= MAX_CUSTOMER_RETRIES) return null;
  return repo.transition(order.id, ["failed"], { status: "queued", attempts: 0, retry_rounds: order.retry_rounds + 1, failure_reason: null });
}

/** Stale lease after the final attempt (worker died) → failed, so the customer can retry. */
export async function settleStale(repo: Repo, order: OrderRow, now = Date.now()): Promise<OrderRow> {
  if (order.status === "processing" && order.attempts >= order.max_attempts && order.locked_until && new Date(order.locked_until).getTime() < now) {
    return (await repo.transition(order.id, ["processing"], { status: "failed", locked_until: null, lease_id: null, failure_reason: "Processing was interrupted." })) ?? order;
  }
  return order;
}

/** Private access links stop working once the order expires. */
export function isExpired(order: Pick<OrderRow, "expires_at">, now = Date.now()): boolean {
  return Boolean(order.expires_at && new Date(order.expires_at).getTime() <= now);
}
