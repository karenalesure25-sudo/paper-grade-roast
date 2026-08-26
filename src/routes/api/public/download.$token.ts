import { createFileRoute } from "@tanstack/react-router";
import { findDeliverable } from "@/lib/order-store.server";
import { renderResumeDocument, slugify } from "@/lib/deliverable-doc";
import { isCoverLetterStyle, renderCoverLetterHtml } from "@/lib/cover-letter-doc";

/**
 * Public, unguessable download link emailed to the buyer.
 * The token is a random UUID and stops working after the order's 7-day window.
 */
export const Route = createFileRoute("/api/public/download/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const found = await findDeliverable(params.token);

        if (found.kind === "expired") {
          return new Response(
            "This download link has expired. Kay’s Career Solutions keeps delivered files for 7 days only.",
            { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } },
          );
        }
        if (found.kind === "missing") {
          return new Response("Download not found.", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const slug = slugify(found.name, "kcs");

        if (found.kind === "resume") {
          return new Response(renderResumeDocument(found.resume, found.template), {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Disposition": `attachment; filename="${slug}-resume.html"`,
              "Cache-Control": "no-store",
            },
          });
        }

        const styleParam = new URL(request.url).searchParams.get("style");
        const style = isCoverLetterStyle(styleParam) ? styleParam : "ivory";

        return new Response(
          renderCoverLetterHtml(found.letter, style, {
            name: found.resume?.name,
            title: found.resume?.title,
            email: found.resume?.email,
            phone: found.resume?.phone,
            location: found.resume?.location,
            ...(found.jobLabel ? { jobLabel: found.jobLabel } : {}),
          }),
          {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="${slug}-cover-letter.html"`,
            "Cache-Control": "no-store",
          },
          },
        );
      },
    },
  },
});
