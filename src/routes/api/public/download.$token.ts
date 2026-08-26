import { createFileRoute } from "@tanstack/react-router";
import { findDeliverable } from "@/lib/order-store.server";
import {
  renderCoverLetterDocument,
  renderResumeDocument,
  slugify,
} from "@/lib/deliverable-doc";

/**
 * Public, unguessable download link emailed to the buyer.
 * The token is a random UUID and stops working after the order's 7-day window.
 */
export const Route = createFileRoute("/api/public/download/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const found = await findDeliverable(params.token);

        if (found.kind === "expired") {
          return new Response(
            "This download link has expired. Callback keeps delivered files for 7 days only.",
            { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } },
          );
        }
        if (found.kind === "missing") {
          return new Response("Download not found.", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const slug = slugify(found.name, "callback");

        if (found.kind === "resume") {
          return new Response(renderResumeDocument(found.resume), {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Disposition": `attachment; filename="${slug}-resume.html"`,
              "Cache-Control": "no-store",
            },
          });
        }

        return new Response(renderCoverLetterDocument(found.letter), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${slug}-cover-letter.txt"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
