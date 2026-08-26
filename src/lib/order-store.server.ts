import type { ResumeData } from "./resume-templates";
import type { AtsReport } from "./order.server";

export type SavedOrder = {
  id: string;
  email: string;
  tier: string;
  template: string;
  resumeToken: string;
  letterToken: string;
  expiresAt: string;
};

type SaveInput = {
  email: string;
  tier: string;
  template: string;
  sourceLabel?: string;
  jobLabel?: string;
  resume: ResumeData;
  coverLetter?: string;
  atsReport?: AtsReport;
};

/**
 * Persists the finished deliverables so the confirmation email can link to them.
 * Rows are purged automatically once `expires_at` (7 days) passes.
 */
export async function saveOrderRecord(input: SaveInput): Promise<SavedOrder> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      email: input.email,
      tier: input.tier,
      template: input.template,
      source_label: input.sourceLabel ?? null,
      job_label: input.jobLabel ?? null,
      resume: input.resume as unknown as never,
      cover_letter: input.coverLetter ?? null,
      ats_report: (input.atsReport ?? null) as unknown as never,
    })
    .select("id, email, tier, template, resume_token, letter_token, expires_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not store the order.");
  }

  return {
    id: data.id,
    email: data.email,
    tier: data.tier,
    template: data.template,
    resumeToken: data.resume_token,
    letterToken: data.letter_token,
    expiresAt: data.expires_at,
  };
}

export type DeliverableLookup =
  | { kind: "resume"; resume: ResumeData; name: string }
  | { kind: "letter"; letter: string; name: string }
  | { kind: "expired" }
  | { kind: "missing" };

/** Resolves a download token from an order email into the file it points at. */
export async function findDeliverable(token: string): Promise<DeliverableLookup> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return { kind: "missing" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("resume, cover_letter, resume_token, letter_token, expires_at")
    .or(`resume_token.eq.${token},letter_token.eq.${token}`)
    .maybeSingle();

  if (error || !data) return { kind: "missing" };
  if (new Date(data.expires_at).getTime() < Date.now()) return { kind: "expired" };

  const resume = data.resume as unknown as ResumeData;

  if (data.resume_token === token) {
    return { kind: "resume", resume, name: resume?.name ?? "" };
  }
  if (!data.cover_letter) return { kind: "missing" };
  return { kind: "letter", letter: data.cover_letter, name: resume?.name ?? "" };
}
