import { checkLength, checkReadable, cleanSource, type SourceKind } from "./roast-grounding";
import { gradeResumeText, type RoastOutcome } from "./roast.server";

export type RoastResult =
  | (Extract<RoastOutcome, { status: "graded" }> & { label: string })
  | { status: "unreadable"; message: string; label: string }
  | { status: "too_long"; message: string; label: string }
  | { status: "not_resume"; message: string; label: string }
  | { status: "unavailable"; message: string; label: string };

type Input =
  | { source: "pdf"; filename: string; dataBase64: string }
  | { source: "docx" | "text"; filename?: string | undefined; text: string };

async function pdfToText(b64: string): Promise<string | null> {
  try {
    const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
    if (bytes.byteLength > 5 * 1024 * 1024) return null;
    // %PDF- magic header
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return null;
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return typeof text === "string" ? text : (text as string[]).join("\n");
  } catch {
    return null;
  }
}

export async function gradeAnySource(input: Input): Promise<RoastResult> {
  const label = input.filename?.trim() || (input.source === "text" ? "Pasted résumé" : "Résumé");
  const kind: SourceKind = input.source;

  const raw = input.source === "pdf" ? await pdfToText(input.dataBase64) : input.text;
  if (raw === null) {
    return {
      status: "unreadable",
      label,
      message:
        "We couldn't read text from this PDF (it may be scanned, image-only, password-protected, or damaged). That's not a grade — try a DOCX or paste the text.",
    };
  }
  const text = cleanSource(raw);
  const length = checkLength(text);
  if (!length.ok) return { status: "too_long", label, message: length.reason };
  const readable = checkReadable(text);
  if (!readable.ok) {
    return {
      status: "unreadable",
      label,
      message: `${readable.reason} That's not a grade — try another file or paste the text.`,
    };
  }

  const outcome = await gradeResumeText(text, kind);
  return { ...outcome, label };
}
