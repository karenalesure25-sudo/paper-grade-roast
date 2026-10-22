import type { StripeMode } from "./stripe-mode";

/** Shared webhook handler; each mode has its own route and signing secret. */
export async function handleStripeWebhook(request: Request, mode: StripeMode): Promise<Response> {
  const secret = process.env[mode === "live" ? "STRIPE_WEBHOOK_SECRET" : "STRIPE_TEST_WEBHOOK_SECRET"];
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const body = await request.text();
  const { verifyStripeSignature } = await import("../stripe.server");
  if (!(await verifyStripeSignature(body, request.headers.get("stripe-signature"), secret))) {
    return new Response("Invalid signature", { status: 400 });
  }
  let evt: { id: string; type: string; livemode?: boolean; data?: { object?: { id?: string } } };
  try {
    evt = JSON.parse(body);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const { handleStripeEvent } = await import("./service.server");
  try {
    const outcome = await handleStripeEvent(evt, mode);
    return Response.json({ received: true, outcome });
  } catch {
    // Non-2xx makes Stripe retry; the event row was released so the retry is processed.
    return new Response("Temporary failure", { status: 500 });
  }
}
