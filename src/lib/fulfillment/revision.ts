/**
 * Post-delivery revisions. I/O injected so tests run the exact logic.
 *
 * - "minor": the one included minor revision (wording / correction / formatting within the
 *   locked template), requestable until the end of the 7th Central calendar day after files were
 *   first available. Consumed ONLY by a completed, validated revision (a ready "minor" row).
 * - "correction": a free fix for an error the service introduced. It must be provable: the
 *   delivered text must be quoted, absent from the customer's original source, and the source
 *   must contain the correct fact. Unprovable claims are declined, never auto-approved.
 *
 * Customer request text is untrusted data. It never becomes a fact: every revised document is
 * validated against the ORIGINAL source facts with the same deterministic checks and an
 * independent fact-check as the first delivery. The original package is never overwritten.
 */
import {
  factsFor, LeaseLost, MAX_GENERATIONS_PER_ATTEMPT,
  type DeliveredPackage, type ExportCheck, type OrderRow,
} from "./engine";
import { buildKeywordReport, containsPhrase, resumeProse, validatePackage, type FullResume, type Package, type SourceFacts, type Violation } from "./validate";
import type { CheckVerdict, WriterOutput } from "./writer.server";
import { addEligibleHours, DELIVERY_WINDOW_HOURS, minorRevisionOpen } from "./service-time";

export type RevisionKind = "minor" | "correction";
export type RevisionStatus = "queued" | "processing" | "needs_information" | "ready" | "failed" | "rejected";
export const REVISION_TEXT = { min: 10, max: 1500 } as const;
export const MAX_REVISION_CLARIFICATIONS = 2;
export const MAX_REVISION_RETRIES = 2;

export type RevisionRow = {
  id: string;
  order_id: string;
  kind: RevisionKind;
  status: RevisionStatus;
  request_text: string;
  idempotency_key: string;
  clarifications: Array<{ at: string; text: string }>;
  clarification_request: string | null;
  requested_at: string;
  deadline_at: string;
  attempts: number;
  max_attempts: number;
  retry_rounds: number;
  lease_id: string | null;
  locked_until: string | null;
  result: DeliveredPackage | null;
  version: number | null;
  failure_reason: string | null;
  completed_at: string | null;
  /** Delivered package this request edits, fixed at reservation: null = original (v1). */
  base_revision_id: string | null;
  base_version: number;
};

export type RequestOutcome = "created" | "duplicate" | "not_eligible" | "invalid" | "pending" | "limit" | "window_closed" | "already_used";

export type RevisionRepo = {
  order(id: string): Promise<OrderRow | null>;
  /** Atomic reservation (row-locked). Rejections insert nothing. Must throw on infrastructure error. */
  request(orderId: string, kind: RevisionKind, text: string, idem: string, deadline: string): Promise<{ outcome: RequestOutcome; id?: string }>;
  byId(id: string): Promise<RevisionRow | null>;
  forOrder(orderId: string): Promise<RevisionRow[]>;
  claim(id: string): Promise<RevisionRow | null>;
  /** Lease-fenced: applies only while status=processing AND lease_id matches. */
  finish(id: string, lease: string, patch: Partial<RevisionRow>): Promise<RevisionRow | null>;
  renew(id: string, lease: string): Promise<boolean>;
  transition(id: string, from: RevisionStatus[], patch: Partial<RevisionRow>): Promise<RevisionRow | null>;
  nextVersion(orderId: string): Promise<number>;
  /** Atomic retry (order-locked): checks failed status, rounds, one-open, minor-used, expiry; rebases onto latest delivered. */
  retry(id: string): Promise<RetryOutcome>;
  /** Atomic stale settle: only while lease_id matches AND locked_until has passed. */
  settleStale(id: string, lease: string, reason: string): Promise<boolean>;
};

export type RetryOutcome = "queued" | "not_found" | "not_failed" | "expired" | "limit" | "pending" | "already_used";

export type Classification = {
  scope: "minor" | "out_of_scope" | "unclear";
  reason: string;
  question?: string;
  introducedError?: { deliveredQuote: string; sourceQuote: string } | null;
};

export type RevisionInput = { facts: SourceFacts; delivered: DeliveredPackage; kind: RevisionKind; request: string; clarifications: string[] };

export type RevisionModelPort = {
  classify(input: RevisionInput): Promise<Classification>;
  revise(input: RevisionInput, feedback: Violation[]): Promise<WriterOutput>;
  check(facts: SourceFacts, output: unknown): Promise<CheckVerdict>;
  /** Independent scope check: did the revision apply ONLY the requested edit to the base? Must fail closed. */
  scopeCheck(input: RevisionInput, revised: Package): Promise<CheckVerdict>;
};

const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Deterministic change bounds between the selected base and a revision. A minor revision edits a few
 * lines; structure (employers, schools, credentials) stays fixed and most lines must be preserved.
 */
export function scopeViolations(base: FullResume, next: FullResume): Violation[] {
  const v: Violation[] = [];
  const key = (r: FullResume) => JSON.stringify({
    exp: r.experience.map((e) => norm(e.company)),
    edu: r.education.map((e) => [norm(e.school), norm(e.credential)]),
    cert: r.certifications.map((c) => norm(JSON.stringify(c))),
  });
  if (key(base) !== key(next)) v.push({ code: "scope_structure", detail: "Keep the same employers, schools and credentials, in the same order, as the delivered version." });
  const units = (r: FullResume) => {
    const u: string[] = [r.title, r.summary, r.objective ?? "", r.location ?? "", r.skills.map(norm).sort().join("|")];
    r.experience.forEach((e) => { u.push(`${e.role}|${e.location ?? ""}|${e.dates}`); e.bullets.forEach((b) => u.push(b)); });
    r.education.forEach((e) => u.push(`${e.dates ?? ""}`));
    return u.map((x) => norm(String(x)));
  };
  const a = units(base), b = units(next);
  const len = Math.max(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) changed++;
  const allowed = Math.max(3, Math.ceil(a.length * 0.25));
  if (changed === 0) v.push({ code: "scope_no_change", detail: "The requested change was not applied." });
  if (changed > allowed) v.push({ code: "scope_rewrite", detail: `Change only the lines the request asks about; ${changed} lines differ from the delivered version.` });
  return v;
}

/** Deterministic scope screen. Returns a customer-facing reason when clearly out of scope. */
export function screenRequest(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(switch|change|swap|different|new|another)\s+(the\s+)?(template|layout|design|style)\b/.test(t)) return "Switching templates isn’t part of a minor revision; your selected template stays locked.";
  if (/\b(different|new|another|other)\s+(target\s+)?(job|role|position|posting|career|industry)\b|\btailor\b.*\b(another|different|new)\b/.test(t)) return "Retargeting to a different job isn’t part of a minor revision.";
  if (/\b(rewrite|redo|start over|from scratch)\b.*\b(everything|whole|entire|all)\b|\b(complete(ly)?|full|entire)\s+rewrite\b|\bstart over\b|\bfrom scratch\b/.test(t)) return "A full rewrite isn’t part of a minor revision.";
  if (/\badd\s+(a\s+|an\s+|my\s+)?(new\s+|another\s+)?(job|position|role|employer|degree|certification|internship|experience section)\b/.test(t)) return "Adding substantial new experience isn’t part of a minor revision.";
  return null;
}

export function cleanRequest(text: string): string | null {
  const s = text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return s.length >= REVISION_TEXT.min && s.length <= REVISION_TEXT.max ? s : null;
}

/** A correction is free only when it proves the delivered text departed from the customer's own source. */
export function provesIntroducedError(order: OrderRow, base: Package | null, ev: Classification["introducedError"]): boolean {
  if (!ev || !base) return false;
  const delivered = ev.deliveredQuote.trim();
  const source = ev.sourceQuote.trim();
  if (delivered.length < 3 || source.length < 3 || delivered.length > 300 || source.length > 300) return false;
  const deliveredText = [resumeProse(base.resume), base.coverLetter ?? ""].join("\n");
  const facts = factsFor(order);
  return containsPhrase(deliveredText, delivered) && containsPhrase(facts.text, source) && !containsPhrase(facts.text, delivered);
}

export type RequestResult = { ok: true; id: string; duplicate: boolean } | { ok: false; reason: RequestOutcome | "expired"; message: string };

const MESSAGES: Record<Exclude<RequestOutcome, "created" | "duplicate">, string> = {
  not_eligible: "Revisions open once your files are delivered on a paid order.",
  invalid: `Describe the change in ${REVISION_TEXT.min}–${REVISION_TEXT.max} characters.`,
  pending: "You already have a request in progress. You can send another after it finishes.",
  limit: "This order has reached its request limit.",
  window_closed: "The 7-day window for your included minor revision has closed.",
  already_used: "Your included minor revision has already been delivered.",
};

/** Validates and atomically reserves a revision. Nothing is consumed here. */
export async function requestRevision(
  repo: RevisionRepo, order: OrderRow, kind: RevisionKind, rawText: string, idem: string, now = new Date(),
): Promise<RequestResult> {
  if (order.expires_at && new Date(order.expires_at).getTime() <= now.getTime()) return { ok: false, reason: "expired", message: "This order link has expired." };
  if (!order.paid_at || order.status !== "ready" || !order.result || !order.delivered_at) return { ok: false, reason: "not_eligible", message: MESSAGES.not_eligible };
  const text = cleanRequest(rawText);
  if (!text || !/^[A-Za-z0-9-]{8,80}$/.test(idem)) return { ok: false, reason: "invalid", message: MESSAGES.invalid };
  if (kind === "minor" && !minorRevisionOpen(order.delivered_at, now)) return { ok: false, reason: "window_closed", message: MESSAGES.window_closed };
  const deadline = addEligibleHours(now, DELIVERY_WINDOW_HOURS.max).toISOString();
  const r = await repo.request(order.id, kind, text, idem, deadline);
  if ((r.outcome === "created" || r.outcome === "duplicate") && r.id) return { ok: true, id: r.id, duplicate: r.outcome === "duplicate" };
  const reason = r.outcome === "created" || r.outcome === "duplicate" ? "not_eligible" : r.outcome;
  return { ok: false, reason, message: MESSAGES[reason] };
}

export type RevisionOutcome = RevisionStatus | "busy" | "lease_lost";

const NOT_PROVEN = "We couldn’t confirm this as an error we introduced: the quoted text must appear in your delivered file and the correct detail must appear in the résumé or answers you gave us. Nothing was used up. You can quote the exact lines, or send it as your included minor revision.";

/** Claim and process one revision. Safe to call concurrently and repeatedly. */
export async function processRevision(
  repo: RevisionRepo, models: RevisionModelPort, id: string, opts: { exportCheck?: ExportCheck; now?: () => Date } = {},
): Promise<RevisionOutcome> {
  const now = opts.now ?? (() => new Date());
  const claimed = await repo.claim(id);
  if (!claimed) return "busy";
  const lease = claimed.lease_id;
  if (!lease) throw new Error("claim returned no lease");
  const finish = async (patch: Partial<RevisionRow>): Promise<RevisionOutcome> => {
    const done = await repo.finish(claimed.id, lease, { lease_id: null, locked_until: null, ...patch });
    return done ? (patch.status as RevisionStatus) : "lease_lost";
  };
  const beat = async () => { if (!(await repo.renew(claimed.id, lease))) throw new LeaseLost(); };

  const order = await repo.order(claimed.order_id);
  if (!order || order.status !== "ready" || !order.result) return finish({ status: "rejected", failure_reason: MESSAGES.not_eligible });

  const screened = screenRequest([claimed.request_text, ...claimed.clarifications.map((c) => c.text)].join("\n"));
  if (screened) return finish({ status: "rejected", failure_reason: `${screened} Nothing was used up.` });

  // The edit applies to the package fixed at reservation, never silently to the original.
  let base: DeliveredPackage | null = order.result;
  if (claimed.base_revision_id) {
    const b = await repo.byId(claimed.base_revision_id);
    base = b && b.order_id === order.id && b.status === "ready" && b.result && b.version === claimed.base_version ? b.result : null;
  }
  if (!base) return finish({ status: "failed", failure_reason: "We couldn’t load the version this request builds on. Your files are unchanged and nothing was used up." });
  const facts = factsFor(order);
  const input: RevisionInput = { facts, delivered: base, kind: claimed.kind, request: claimed.request_text, clarifications: claimed.clarifications.map((c) => c.text) };
  try {
    await beat();
    const cls = await models.classify(input);
    if (cls.scope === "out_of_scope") return finish({ status: "rejected", failure_reason: `${cls.reason || "That change is outside a minor revision."} Nothing was used up.` });
    if (cls.scope === "unclear") {
      if (claimed.clarifications.length >= MAX_REVISION_CLARIFICATIONS) return finish({ status: "rejected", failure_reason: "We still couldn’t tell exactly what to change. Nothing was used up; you can send a new, more specific request." });
      return finish({ status: "needs_information", clarification_request: (cls.question || "Which exact line should change, and how?").slice(0, 400) });
    }
    if (claimed.kind === "correction" && !provesIntroducedError(order, base, cls.introducedError ?? null)) {
      return finish({ status: "rejected", failure_reason: NOT_PROVEN });
    }

    let feedback: Violation[] = [];
    const keywords = base.keywordReport?.rows.map((r) => r.keyword) ?? [];
    for (let g = 1; g <= MAX_GENERATIONS_PER_ATTEMPT; g++) {
      await beat();
      const out = await models.revise(input, feedback);
      if (out.kind === "needs_information") {
        if (claimed.clarifications.length >= MAX_REVISION_CLARIFICATIONS) return finish({ status: "rejected", failure_reason: "We couldn’t make that change using only facts you already gave us. Nothing was used up." });
        return finish({ status: "needs_information", clarification_request: (out.questions[0] ?? "Can you clarify the change?").slice(0, 400) });
      }
      const resume: FullResume = { ...out.resume, name: facts.name, email: facts.email, phone: facts.phone };
      const coverLetter = out.coverLetter ?? (base.coverLetter && facts.tier !== "bundle" ? base.coverLetter : undefined);
      const keywordReport = facts.job ? buildKeywordReport(keywords, facts.job.text, facts.text, resume) : undefined;
      const pkg: Package = { resume, ...(coverLetter ? { coverLetter } : {}), ...(keywordReport ? { keywordReport } : {}) };
      const violations = validatePackage(pkg, facts);
      if (facts.tier === "bundle" && !out.coverLetter) violations.push({ code: "cover_letter", detail: "Return the cover letter updated to stay consistent with the revised résumé." });
      violations.push(...scopeViolations(base.resume, resume));
      if (violations.length) { feedback = violations; continue; }
      await beat();
      const scope = await models.scopeCheck(input, pkg);
      if (!scope.approved) { feedback = (scope.problems.length ? scope.problems : ["scope check rejected"]).map((p) => ({ code: "scope_check", detail: p })); continue; }
      const verdict = await models.check(facts, { resume, coverLetter: pkg.coverLetter });
      if (!verdict.approved) { feedback = verdict.problems.map((p) => ({ code: "fact_check", detail: p })); continue; }
      const exportProblems = opts.exportCheck ? await opts.exportCheck(pkg) : [];
      if (exportProblems.length) { feedback = exportProblems; continue; }
      const version = await repo.nextVersion(order.id);
      const at = now().toISOString();
      return finish({
        status: "ready", version, completed_at: at, failure_reason: null, clarification_request: null,
        result: { ...pkg, validatedAt: at, checks: { deterministic: "passed", independent: "passed", exports: "passed", generations: g } },
      });
    }
    console.error("revision validation rejected", { id, codes: [...new Set(feedback.map((v) => v.code))] });
    return failedAttempt("Our accuracy checks couldn’t approve a revised version that uses only facts you already gave us. Your original files are unchanged and nothing was used up.");
  } catch (e) {
    if (e instanceof LeaseLost) return "lease_lost";
    console.error("revision attempt errored", { id });
    return failedAttempt("We hit a temporary problem preparing your revision. Your original files are unchanged and nothing was used up.");
  }

  async function failedAttempt(reason: string): Promise<RevisionOutcome> {
    const last = claimed!.attempts >= claimed!.max_attempts;
    return finish({ status: last ? "failed" : "queued", failure_reason: reason });
  }
}

export async function answerRevision(repo: RevisionRepo, rev: RevisionRow, raw: string, now = new Date()) {
  const text = cleanRequest(raw);
  if (!text || rev.status !== "needs_information" || rev.clarifications.length >= MAX_REVISION_CLARIFICATIONS) return null;
  return repo.transition(rev.id, ["needs_information"], {
    status: "queued", attempts: 0, clarification_request: null,
    clarifications: [...rev.clarifications, { at: now.toISOString(), text }],
    // The window runs from the complete request.
    deadline_at: addEligibleHours(now, DELIVERY_WINDOW_HOURS.max).toISOString(),
  });
}

export const RETRY_MESSAGES: Record<RetryOutcome, string> = {
  queued: "Retrying your revision.",
  not_found: "We couldn’t find that request.",
  not_failed: "That request isn’t waiting for a retry.",
  expired: "This order link has expired.",
  limit: "This request has reached its retry limit. You can send a new, more specific request.",
  pending: "Another request is already in progress. You can retry after it finishes.",
  already_used: "Your included minor revision has already been delivered, so this one can’t be retried.",
};

/** Eligibility is enforced atomically by the repo (order-locked); this only shapes the reply. */
export async function retryRevision(repo: RevisionRepo, rev: RevisionRow): Promise<{ ok: boolean; reason: RetryOutcome; message: string }> {
  if (rev.status !== "failed") return { ok: false, reason: "not_failed", message: RETRY_MESSAGES.not_failed };
  const reason = await repo.retry(rev.id);
  return { ok: reason === "queued", reason, message: RETRY_MESSAGES[reason] };
}

const INTERRUPTED = "Processing was interrupted. Your original files are unchanged and nothing was used up.";

export async function settleStaleRevision(repo: RevisionRepo, rev: RevisionRow, now = Date.now()) {
  if (rev.status === "processing" && rev.lease_id && rev.attempts >= rev.max_attempts && rev.locked_until && new Date(rev.locked_until).getTime() < now) {
    // Fenced on the lease we observed: a renewed or reclaimed lease makes this a no-op.
    if (await repo.settleStale(rev.id, rev.lease_id, INTERRUPTED)) return (await repo.byId(rev.id)) ?? rev;
    return (await repo.byId(rev.id)) ?? rev;
  }
  return rev;
}

/** Included minor revision state for display. */
export function minorRevisionState(order: Pick<OrderRow, "delivered_at">, revisions: RevisionRow[], now = new Date()) {
  if (revisions.some((r) => r.kind === "minor" && r.status === "ready")) return "used" as const;
  if (revisions.some((r) => ["queued", "processing", "needs_information"].includes(r.status))) return "pending" as const;
  return minorRevisionOpen(order.delivered_at, now) ? ("available" as const) : ("closed" as const);
}
