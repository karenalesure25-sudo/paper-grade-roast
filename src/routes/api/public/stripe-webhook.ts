import { createFileRoute } from "@tanstack/react-router";

/** Stripe webhook: signature-verified, idempotent per event; payment re-verified with Stripe. */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const body = await request.text();
        const { verifyStripeSignature } = await import("@/lib/stripe.server");
        if (!(await verifyStripeSignature(body, request.headers.get("stripe-signature"), secret))) {
          return new Response("Invalid signature", { status: 400 });
        }
        let evt: { id: string; type: string; data?: { object?: { id?: string } } };
        try {
          evt = JSON.parse(body);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }
        const { handleStripeEvent } = await import("@/lib/fulfillment/service.server");
        const outcome = await handleStripeEvent(evt);
        return Response.json({ received: true, outcome });
      },
    },
  },
});
