/** Production wiring of the fulfillment engine (Supabase + Stripe + Lovable AI). Server-only. */
import type { TierId } from "../products";
import {
  addClarification, confirmPayment, processOrder, retryFailed, settleStale,
  type OrderRow, type StripeSessionView,
} from "./engine";
import { extractDocumentText } from "./extract.server";
import { orderByToken, supabaseRepo } from "./repo.server";
import { buildSnapshotSource } from "./snapshot";
import { liveModels } from "./writer.server";

const BUCKET = "intake-uploads";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getSession(id: string): Promise<StripeSessionView> {
  const { getCheckoutSession } = await import("../stripe.server");
  return (await getCheckoutSession(id)) as unknown as StripeSessionView;
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
export async function createOrderCheckout(input: { intakeId: string; template: string; photo?: string | undefined; origin: string }) {
  const db = await admin();
  const { data: intake } = await db.from("intakes" as never).select("*").eq("id", input.intakeId).maybeSingle();
  const row = intake as null | {
    id: string; tier: TierId; confirmed: boolean; answers: Record<string, unknown>; created_at: string;
    resume_path: string | null; resume_filename: string | null; job_file_path: string | null; job_file_filename: string | null;
    job_description: string | null;
  };
  if (!row || !row.confirmed) throw new Error("We couldn't find your submitted intake. Please submit it again.");
  if (Date.now() - new Date(row.created_at).getTime() > 24 * 3600_000) throw new Error("This intake is over a day old. Please submit it again.");

  const { data: existing } = await db.from("fulfillment_orders" as never).select("id, status, access_token, stripe_session_id").eq("intake_id", row.id).maybeSingle();
  const ex = existing as null | { id: string; status: string; access_token: string; stripe_session_id: string | null };
  if (ex && ex.status !== "awaiting_payment") return { already: true as const, token: ex.access_token };

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
    const photo = input.photo && input.photo.startsWith("data:image/") && input.photo.length < 900_000 ? input.photo : null;
    const { data: created, error } = await db.from("fulfillment_orders" as never).insert({
      intake_id: row.id, tier: row.tier, email: snapshot.email, template: input.template,
      snapshot, source_text: sourceText, job_text: jobText, source_sha256: await sha256(sourceText + "\n" + (jobText ?? "")), photo,
    } as never).select("id, status, access_token, stripe_session_id").single();
    if (error || !created) throw new Error("We couldn't save your order. Try again.");
    order = created as typeof ex & object;
  }

  const { createCheckoutSession, expireCheckoutSession } = await import("../stripe.server");
  if (order!.stripe_session_id) {
    // An earlier unpaid session exists. Reuse it if still open.
    const prev = await getSession(order!.stripe_session_id);
    if (prev.payment_status === "paid") return { already: true as const, token: order!.access_token };
    if (prev.status === "open") return { already: false as const, token: order!.access_token, url: (prev as unknown as { url: string }).url };
    throw new Error("Your previous checkout expired. Please submit the intake again to start a new one.");
  }
  const s = await createCheckoutSession({
    tier: row.tier, email: (row.answers["email"] as string).trim().toLowerCase(), origin: input.origin,
    orderId: order!.id, successPath: `/orders/${order!.access_token}`,
  });
  const linked = await supabaseRepo.transition(order!.id, ["awaiting_payment"], { stripe_session_id: s.id });
  if (!linked || !s.url) {
    await expireCheckoutSession(s.id).catch(() => undefined);
    throw new Error("Checkout couldn't start. Try again.");
  }
  return { already: false as const, token: order!.access_token, url: s.url };
}

export type PublicStatus = {
  status: OrderRow["status"];
  tier: TierId;
  name: string;
  questions: string[];
  failureReason: string | null;
  canRetry: boolean;
  files: Array<{ kind: string; label: string; href: string }>;
  keywordReport?: NonNullable<OrderRow["result"]>["keywordReport"];
  checks?: NonNullable<OrderRow["result"]>["checks"];
  emailed: false;
};

function toPublic(o: OrderRow): PublicStatus {
  const base = `/api/public/order-file/${o.access_token}`;
  const files = o.status === "ready" && o.result
    ? [
        { kind: "resume-docx", label: "Résumé (Word, editable)", href: `${base}/resume.docx` },
        { kind: "resume-html", label: "Résumé (styled, print to PDF)", href: `${base}/resume.html` },
        ...(o.result.coverLetter
          ? [
              { kind: "letter-docx", label: "Cover letter (Word, editable)", href: `${base}/cover-letter.docx` },
              { kind: "letter-html", label: "Cover letter (styled, print to PDF)", href: `${base}/cover-letter.html` },
            ]
          : []),
      ]
    : [];
  return {
    status: o.status, tier: o.tier, name: o.snapshot.name.split(/\s+/)[0] ?? "",
    questions: o.status === "needs_information" ? (o.clarification_request?.questions ?? []) : [],
    failureReason: o.status === "failed" ? o.failure_reason : null,
    canRetry: o.status === "failed" && o.retry_rounds < 2,
    files,
    ...(o.status === "ready" && o.result?.keywordReport ? { keywordReport: o.result.keywordReport } : {}),
    ...(o.status === "ready" && o.result ? { checks: o.result.checks } : {}),
    emailed: false,
  };
}

/** Status read: confirms payment with Stripe if needed and settles dead leases. */
export async function statusByToken(token: string): Promise<PublicStatus | null> {
  let o = await orderByToken(token);
  if (!o) return null;
  o = await confirmPayment(supabaseRepo, getSession, o);
  o = await settleStale(supabaseRepo, o);
  return toPublic(o);
}

/** Runs one processing attempt if due (claim-guarded). */
export async function runByToken(token: string): Promise<PublicStatus | null> {
  const o = await orderByToken(token);
  if (!o) return null;
  await processOrder(supabaseRepo, liveModels, o.id);
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
export async function handleStripeEvent(evt: { id: string; type: string; data?: { object?: { id?: string } } }) {
  const db = await admin();
  const { error } = await db.from("stripe_events" as never).insert({ id: evt.id, type: evt.type } as never);
  if (error?.code === "23505") return "duplicate";
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(evt.type)) return "ignored";
  const sid = evt.data?.object?.id;
  if (!sid) return "ignored";
  const o = await supabaseRepo.bySession(sid);
  if (!o) return "unknown_session";
  const after = await confirmPayment(supabaseRepo, getSession, o);
  return after.status;
}

/** Background sweep: confirm pending payments and process due orders. */
export async function sweep(limit = 2) {
  const db = await admin();
  const { data: pending } = await db.from("fulfillment_orders" as never).select("*")
    .eq("status", "awaiting_payment").not("stripe_session_id", "is", null)
    .gt("created_at", new Date(Date.now() - 2 * 24 * 3600_000).toISOString()).limit(10);
  for (const o of (pending ?? []) as OrderRow[]) await confirmPayment(supabaseRepo, getSession, o).catch(() => undefined);
  const ids = await supabaseRepo.due(limit);
  const results: string[] = [];
  for (const id of ids) results.push(await processOrder(supabaseRepo, liveModels, id));
  return { confirmed: (pending ?? []).length, processed: results };
}
