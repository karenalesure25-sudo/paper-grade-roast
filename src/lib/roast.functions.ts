import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gradeAnySource } from "./roast-pipeline.server";

const MAX_TEXT_CHARS = 24000;
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
    text: z.string().max(MAX_TEXT_CHARS, { message: "That's longer than a résumé (24,000 characters max)." }),
  }),
]);

export type { RoastResult } from "./roast-pipeline.server";

export const roastResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RoastInput.parse(input))
  .handler(async ({ data }) => gradeAnySource(data));
