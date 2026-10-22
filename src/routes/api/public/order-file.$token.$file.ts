import { createFileRoute } from "@tanstack/react-router";

/** Validated deliverables for a ready order. The token is a private random UUID. Logic: src/lib/fulfillment/order-file.ts. */
export const Route = createFileRoute("/api/public/order-file/$token/$file")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { orderByToken, revisionRepo } = await import("@/lib/fulfillment/repo.server");
        const { serveOrderFile } = await import("@/lib/fulfillment/order-file");
        return serveOrderFile({ orderByToken, revisionById: (id) => revisionRepo.byId(id) }, params, request.url);
      },
    },
  },
});
