import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled background sweep (called every minute by the database scheduler).
 * Only advances orders whose payment Stripe itself confirms; claim-guarded, so
 * repeated or concurrent calls never duplicate work. Returns counts only.
 */
export const Route = createFileRoute("/api/public/fulfillment-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { sweep } = await import("@/lib/fulfillment/service.server");
        const r = await sweep(2);
        return Response.json({ confirmed: r.confirmed, processed: r.processed.length });
      },
    },
  },
});
