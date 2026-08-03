export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type PreparedUpload =
  | { kind: "pdf"; filename: string; mimeType: "application/pdf"; dataBase64: string }
  | { kind: "text"; filename: string; text: string };

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return window.btoa(binary);
}

/**
 * PDFs go to the model as-is (it reads them natively); DOCX is converted to
 * plain text in the browser so no document parser has to run on the server.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is over 5MB. Try a smaller export.");
  }

  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return {
      kind: "pdf",
      filename: file.name,
      mimeType: "application/pdf",
      dataBase64: toBase64(await file.arrayBuffer()),
    };
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser.js");
    const { value } = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    const text = value.trim();
    if (!text) throw new Error("That DOCX came back empty. Try a different export.");
    return { kind: "text", filename: file.name, text };
  }

  throw new Error("Upload a PDF or DOCX file.");
}
