import type { OrderRow } from "./engine";
import type { RevisionRow } from "./revision";

/** Injected lookups so the authorization logic is testable without a live database. */
export type OrderFileDeps = {
  orderByToken(token: string): Promise<OrderRow | null>;
  revisionById(id: string): Promise<RevisionRow | null>;
};

const nf = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Validated deliverables for a ready, paid, unexpired order. Optional ?v=<revision id> selects a READY
 * revision belonging to THIS order. Template/photo always stay the order's locked choice.
 */
export async function serveOrderFile(deps: OrderFileDeps, params: { token: string; file: string }, url: string, now = new Date()): Promise<Response> {
  const o = await deps.orderByToken(params.token);
  if (!o || o.status !== "ready" || !o.result || !o.paid_at) return nf();
  if (o.expires_at && new Date(o.expires_at).getTime() <= now.getTime()) return nf();
  const v = new URL(url).searchParams.get("v");
  let pkg = o.result;
  let suffix = "";
  if (v) {
    if (!/^[0-9a-f-]{36}$/i.test(v)) return nf();
    const rev = await deps.revisionById(v);
    if (!rev || rev.order_id !== o.id || rev.status !== "ready" || !rev.result || !rev.version) return nf();
    pkg = rev.result;
    suffix = `-v${rev.version}`;
  }
  const result = pkg;
  const r = result.resume;
  const { slugify, renderResumeDocument } = await import("@/lib/deliverable-doc");
  const slug = slugify(r.name, "kcs") + suffix;
  const head = (type: string, name: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
  });
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  switch (params.file) {
    case "resume.docx": {
      const docx = await import("./docx");
      return new Response(await docx.toDocxBytes(docx.resumeDocxDocument(r, { template: o.template, photo: o.photo ?? null })), { headers: head(DOCX, `${slug}-resume.docx`) });
    }
    case "resume.html":
      return new Response(renderResumeDocument(r, o.template, { photo: o.photo ?? null }), { headers: head("text/html; charset=utf-8", `${slug}-resume.html`) });
    case "cover-letter.docx": {
      if (!result.coverLetter) return nf();
      const docx = await import("./docx");
      return new Response(await docx.toDocxBytes(docx.letterDocxDocument(result.coverLetter, r)), { headers: head(DOCX, `${slug}-cover-letter.docx`) });
    }
    case "cover-letter.html": {
      if (!result.coverLetter) return nf();
      const { renderCoverLetterHtml } = await import("@/lib/cover-letter-doc");
      return new Response(
        renderCoverLetterHtml(result.coverLetter, "ivory", { name: r.name, title: r.title, email: r.email, phone: r.phone, location: r.location }),
        { headers: head("text/html; charset=utf-8", `${slug}-cover-letter.html`) },
      );
    }
    default:
      return nf();
  }
}
