import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gradeResume } from "./roast.server";

const MAX_TEXT_CHARS = 24000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Gemini reads PDFs natively; DOCX text is extracted in the browser before upload.
const RoastInput = z
  .object({
    text: z.string().trim().max(MAX_TEXT_CHARS).optional(),
    file: z
      .object({
        filename: z.string().trim().max(200),
        mimeType: z.literal("application/pdf"),
        dataBase64: z.string().max(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 1024),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.text?.length) || Boolean(v.file), {
    message: "Upload a PDF or DOCX file to get it graded.",
  });

export type RoastResult = {
  grade: string;
  roast: string;
  notes: string[];
  label: string;
};

export const roastResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RoastInput.parse(input))
  .handler(async ({ data }): Promise<RoastResult> => {
    const content: Array<
      | { type: "text"; text: string }
      | { type: "file"; file: { filename: string; file_data: string } }
    > = [];

    if (data.file) {
      content.push({
        type: "text",
        text: "Grade the attached resume.",
      });
      content.push({
        type: "file",
        file: {
          filename: data.file.filename,
          file_data: `data:${data.file.mimeType};base64,${data.file.dataBase64}`,
        },
      });
    } else {
      content.push({
        type: "text",
        text: `Grade this resume:\n\n${data.text}`,
      });
    }

    const result = await gradeResume(content);

    return {
      ...result,
      label: data.file?.filename ?? "pasted_resume.txt",
    };
  });
