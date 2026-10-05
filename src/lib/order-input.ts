import { z } from "zod";

const MAX_TEXT_CHARS = 24000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BASE64 = Math.ceil((MAX_FILE_BYTES * 4) / 3) + 1024;

const FileInput = z.object({
  filename: z.string().trim().max(200),
  mimeType: z.literal("application/pdf"),
  dataBase64: z.string().max(MAX_BASE64),
});

export const OrderInput = z
  .object({
    tier: z.enum(["revamp", "scratch", "bundle"]),
    email: z
      .string()
      .trim()
      .min(1, { message: "Add the email address we should send your order to." })
      .max(255)
      .email({ message: "That email address doesn't look right." }),
    template: z.string().trim().min(1).max(40),
    sessionId: z.string().trim().max(300).optional(),
    text: z.string().trim().max(MAX_TEXT_CHARS).optional(),
    file: FileInput.optional(),
    jobUrl: z.string().trim().url({ message: "That job link doesn't look right." }).max(500).optional(),
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