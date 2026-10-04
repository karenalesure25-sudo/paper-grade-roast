import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gradeAnySource } from "./roast-pipeline.server";

// Generous transport cap; the real 24,000-char limit is enforced (with a clear message) after cleanup.
const MAX_TEXT_CHARS = 200_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** PDFs are sent as bytes and read on the server; DOCX is converted to text in the browser. */
const RoastInput = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("pdf"),
    filename: z.string().trim().min(1).max(200),
    dataBase64: z.string().min(1).max(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 16),
  }),
  z.object({
    source: z.enum(["docx", "text"]),
    filename: z.string().trim().max(200).optional(),
    text: z.string().max(MAX_TEXT_CHARS, { message: "That's far longer than a résumé." }),
  }),
]);

export type { RoastResult } from "./roast-pipeline.server";

export const roastResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RoastInput.parse(input))
  .handler(async ({ data }) => gradeAnySource(data));
