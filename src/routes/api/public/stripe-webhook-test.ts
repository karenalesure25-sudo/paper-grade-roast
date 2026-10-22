import { createFileRoute } from "@tanstack/react-router";

/** Test-mode Stripe webhook: test signing secret only; only affects test-mode orders. */
export const Route = createFileRoute("/api/public/stripe-webhook-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStripeWebhook } = await import("@/lib/fulfillment/stripe-webhook-handler.server");
        return handleStripeWebhook(request, "test");
      },
    },
  },
});
