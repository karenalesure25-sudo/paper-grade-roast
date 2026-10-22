import { createFileRoute } from "@tanstack/react-router";

/** Live Stripe webhook: live signing secret only; test-mode events are rejected. */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStripeWebhook } = await import("@/lib/fulfillment/stripe-webhook-handler.server");
        return handleStripeWebhook(request, "live");
      },
    },
  },
});
