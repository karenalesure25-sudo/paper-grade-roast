import { createFileRoute } from "@tanstack/react-router";

/** Validated deliverables for a ready order. The token is a private random UUID. */
export const Route = createFileRoute("/api/public/order-file/$token/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { orderByToken } = await import("@/lib/fulfillment/repo.server");
        const o = await orderByToken(params.token);
        const nf = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
        if (!o || o.status !== "ready" || !o.result) return nf();
        const r = o.result.resume;
        const { slugify, renderResumeDocument } = await import("@/lib/deliverable-doc");
        const slug = slugify(r.name, "kcs");
        const head = (type: string, name: string) => ({
          "Content-Type": type,
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex",
        });
        const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const docx = await import("@/lib/fulfillment/docx");
        switch (params.file) {
          case "resume.docx":
            return new Response(await docx.toDocxBytes(docx.resumeDocxDocument(r, { template: o.template, photo: o.photo ?? null })), { headers: head(DOCX, `${slug}-resume.docx`) });
          case "resume.html":
            return new Response(renderResumeDocument(r, o.template, { photo: o.photo ?? null }), { headers: head("text/html; charset=utf-8", `${slug}-resume.html`) });
          case "cover-letter.docx":
            if (!o.result.coverLetter) return nf();
            return new Response(await docx.toDocxBytes(docx.letterDocxDocument(o.result.coverLetter, r)), { headers: head(DOCX, `${slug}-cover-letter.docx`) });
          case "cover-letter.html": {
            if (!o.result.coverLetter) return nf();
            const { renderCoverLetterHtml } = await import("@/lib/cover-letter-doc");
            return new Response(
              renderCoverLetterHtml(o.result.coverLetter, "ivory", { name: r.name, title: r.title, email: r.email, phone: r.phone, location: r.location }),
              { headers: head("text/html; charset=utf-8", `${slug}-cover-letter.html`) },
            );
          }
          default:
            return nf();
        }
      },
    },
  },
});
