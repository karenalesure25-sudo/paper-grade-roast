import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { writeResume, type AtsReport, type ContentBlock } from "./order.server";
import type { ResumeData } from "./resume-templates";

const MAX_TEXT_CHARS = 24000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BASE64 = Math.ceil((MAX_FILE_BYTES * 4) / 3) + 1024;

const FileInput = z.object({
  filename: z.string().trim().max(200),
  mimeType: z.literal("application/pdf"),
  dataBase64: z.string().max(MAX_BASE64),
});

const OrderInput = z
  .object({
    tier: z.enum(["revamp", "scratch", "bundle"]),
    email: z
      .string()
      .trim()
      .min(1, { message: "Add the email address we should send your order to." })
      .max(255)
      .email({ message: "That email address doesn't look right." }),
    template: z.string().trim().min(1).max(40),
    text: z.string().trim().max(MAX_TEXT_CHARS).optional(),
    file: FileInput.optional(),
    jobUrl: z.string().trim().max(500).optional(),
    jobText: z.string().trim().max(MAX_TEXT_CHARS).optional(),
    jobFile: FileInput.optional(),
  })
  .refine((v) => Boolean(v.text?.length) || Boolean(v.file), {
    message: "Add your résumé or your background details first.",
  })
  .refine(
    (v) =>
      v.tier !== "bundle" ||
      Boolean(v.jobUrl?.length) ||
      Boolean(v.jobText?.length) ||
      Boolean(v.jobFile),
    {
      message: "Add the job posting: paste a link, paste the text, or upload the file.",
    },
  );

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
    const content: ContentBlock[] = [];

    const instruction =
      data.tier === "scratch"
        ? "Write a résumé from these background notes."
        : data.tier === "bundle"
          ? [
              "Rewrite the attached résumé, optimize it for ATS, and tailor it to the job below. Then write the matching cover letter.",
              data.jobUrl ? `Job posting URL: ${data.jobUrl}` : "",
              data.jobText ? `Job / role details:\n${data.jobText}` : "",
              data.jobFile ? "The job posting is also attached as a file." : "",
            ]
              .filter(Boolean)
              .join("\n")
          : "Rewrite and polish the attached résumé.";

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

