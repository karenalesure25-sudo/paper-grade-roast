/** Server-side text extraction for stored intake files (PDF / DOCX). */
import { cleanSource } from "../roast-grounding";

export type Extracted = { ok: true; text: string } | { ok: false; reason: string };

const MAX = 5 * 1024 * 1024;

export async function extractDocumentText(bytes: Uint8Array, filename: string): Promise<Extracted> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX) return { ok: false, reason: "File is empty or over 5 MB." };
  const lower = filename.toLowerCase();
  try {
    if (lower.endsWith(".pdf")) {
      if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        return { ok: false, reason: "This isn't a valid PDF." };
      }
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: true });
      const out = cleanSource(typeof text === "string" ? text : (text as string[]).join("\n"));
      return out.length >= 40 ? { ok: true, text: out } : { ok: false, reason: "No readable text in this PDF (it may be scanned or image-only)." };
    }
    if (lower.endsWith(".docx")) {
      // ZIP magic "PK"
      if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return { ok: false, reason: "This isn't a valid DOCX." };
      const mammoth = await import("mammoth/mammoth.browser.js");
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
      const out = cleanSource(value ?? "");
      return out.length >= 40 ? { ok: true, text: out } : { ok: false, reason: "No readable text in this DOCX." };
    }
    return { ok: false, reason: "Only PDF or DOCX files can be read." };
  } catch {
    return { ok: false, reason: "We couldn't read this file." };
  }
}
