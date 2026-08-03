import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { writeResume, type ContentBlock } from "./order.server";
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
    text: z.string().trim().max(MAX_TEXT_CHARS).optional(),
    file: FileInput.optional(),
    jobUrl: z.string().trim().max(500).optional(),
    jobText: z.string().trim().max(MAX_TEXT_CHARS).optional(),
  })
  .refine((v) => Boolean(v.text?.length) || Boolean(v.file), {
    message: "Add your résumé or your background details first.",
  })
  .refine((v) => v.tier !== "bundle" || Boolean(v.jobUrl?.length), {
    message: "Paste the link to the job you want this tailored to.",
  });

export type OrderResult = {
  tier: "revamp" | "scratch" | "bundle";
  resume: ResumeData;
  sourceLabel: string;
  jobUrl?: string;
};

export const buildResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => OrderInput.parse(input))
  .handler(async ({ data }): Promise<OrderResult> => {
    const content: ContentBlock[] = [];

    const instruction =
      data.tier === "scratch"
        ? "Write a résumé from these background notes."
        : data.tier === "bundle"
          ? `Rewrite the attached résumé and tailor it to this job posting.\nJob posting URL: ${data.jobUrl}\n${
              data.jobText ? `Job posting details:\n${data.jobText}` : ""
            }`
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

    const resume = await writeResume(data.tier, content);

    return {
      tier: data.tier,
      resume,
      sourceLabel: data.file?.filename ?? "your notes",
      ...(data.jobUrl ? { jobUrl: data.jobUrl } : {}),
    };
  });
