import { createServerFn } from "@tanstack/react-start";
import { OrderInput } from "./order-input";
import { writeResume, type AtsReport, type ContentBlock } from "./order.server";
import type { ResumeData } from "./resume-templates";

export type OrderResult = {
  tier: "revamp" | "scratch" | "bundle";
  resume: ResumeData;
  sourceLabel: string;
  jobUrl?: string;
  jobLabel?: string;
  /** Bundle tier only: the tailored cover letter for that job. */
  coverLetter?: string;
  /** Bundle tier only: ATS scoring against the supplied job posting. */
  atsReport?: AtsReport;
  /** Where the confirmation email went. */
  email?: string;
  /** True only when the confirmation email actually went out. */
  emailed?: boolean;
  /** Expiring download links, also emailed to the buyer. */
  resumeUrl?: string;
  coverLetterUrl?: string;
  /** ISO date the download links stop working. */
  downloadsExpireAt?: string;
};

export type { AtsReport };


export const buildResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => OrderInput.parse(input))
  .handler(async ({ data }): Promise<OrderResult> => {
    // Hard server-side gate: Stripe must confirm a paid session for this tier + email.
    const { verifyPayment, claimSession, markDelivered } = await import("./payment-gate.server");
    const check = await verifyPayment({ sessionId: data.sessionId, tier: data.tier, email: data.email });
    if (!check.ok) throw new Error(check.reason);
    if (!(await claimSession(check.sessionId, data.tier, data.email))) {
      throw new Error("This payment was already used for a delivered résumé.");
    }
    if (data.tier === "bundle" && !data.jobText?.trim() && !data.jobFile) {
      throw new Error("Paste the job description or upload the job posting — we don't fetch links.");
    }
    const content: ContentBlock[] = [];

    const instruction =
      data.tier === "scratch"
        ? "Write a résumé from these background notes."
        : data.tier === "bundle"
          ? [
              "Rewrite the attached résumé in polished professional language, optimize it for ATS, and tailor it to the job below. Then write the matching cover letter.",
              data.jobUrl ? `Job posting URL (reference only, not fetched): ${data.jobUrl}` : "",
              data.jobText ? `Job / role details:\n${data.jobText}` : "",
              data.jobFile ? "The job posting is also attached as a file." : "",
            ]
              .filter(Boolean)
              .join("\n")
          : [
              "Perform a full professional résumé revamp from the attached résumé.",
              "Rewrite the summary, objective, skills, and every bullet in stronger professional language.",
              "Do not lightly polish or copy the original wording back; preserve only factual details such as names, dates, employers, schools, credentials, contact details, and real tools/skills.",
            ].join("\n");

    content.push({ type: "text", text: instruction });

    if (data.file) {
      content.push({
        type: "file",
        file: {
          filename: data.file.filename,
          file_data: `data:${data.file.mimeType};base64,${data.file.dataBase64}`,
        },
      });
    } else if (data.text) {
      content.push({ type: "text", text: data.text });
    }

    if (data.jobFile) {
      content.push({
        type: "file",
        file: {
          filename: data.jobFile.filename,
          file_data: `data:${data.jobFile.mimeType};base64,${data.jobFile.dataBase64}`,
        },
      });
    }

    const written = await writeResume(data.tier, content);

    const jobLabel =
      data.tier === "bundle"
        ? (data.jobUrl ?? data.jobFile?.filename ?? "the role you sent us")
        : undefined;

    const sourceLabel = data.file?.filename ?? "your notes";

    const { deliverOrder } = await import("./order-delivery.server");
    const delivery = await deliverOrder({
      email: data.email,
      tier: data.tier,
      template: data.template,
      sourceLabel,
      ...(jobLabel ? { jobLabel } : {}),
      resume: written.resume,
      ...(written.coverLetter ? { coverLetter: written.coverLetter } : {}),
      ...(written.atsReport ? { atsReport: written.atsReport } : {}),
    });

    await markDelivered(check.sessionId);

    return {
      tier: data.tier,
      resume: written.resume,
      sourceLabel,
      email: data.email,
      emailed: delivery.emailed,
      ...(data.jobUrl ? { jobUrl: data.jobUrl } : {}),
      ...(jobLabel ? { jobLabel } : {}),
      ...(written.coverLetter ? { coverLetter: written.coverLetter } : {}),
      ...(written.atsReport ? { atsReport: written.atsReport } : {}),
      ...(delivery.resumeUrl ? { resumeUrl: delivery.resumeUrl } : {}),
      ...(delivery.coverLetterUrl ? { coverLetterUrl: delivery.coverLetterUrl } : {}),
      ...(delivery.expiresAt ? { downloadsExpireAt: delivery.expiresAt } : {}),
    };
  });

