/**
 * Server-only payment gate for paid deliverables.
 *
 * A paid deliverable is released only when Stripe itself confirms the Checkout
 * Session is complete and paid, for this exact tier, amount, currency and email,
 * and the session hasn't already been redeemed. Nothing the browser sends
 * (flags, amounts, query params) can satisfy this gate on its own.
 */
import type { TierId } from "./products";
import { getCheckoutSession, TIER_PRICING } from "./stripe.server";

export type PaymentCheck = { ok: true; sessionId: string } | { ok: false; reason: string };

export async function verifyPayment(input: {
  sessionId: string | undefined;
  tier: TierId;
  email: string;
}): Promise<PaymentCheck> {
  const id = input.sessionId?.trim();
  if (!id || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) {
    return { ok: false, reason: "Complete checkout first — we couldn't find a payment for this order." };
  }
  const s = await getCheckoutSession(id);
  const expected = TIER_PRICING[input.tier];
  const paid =
    s.mode === "payment" &&
    s.status === "complete" &&
    s.payment_status === "paid" &&
    s.amount_total === expected.cents &&
    s.currency === "usd" &&
    s.metadata?.["tier"] === input.tier &&
    s.metadata?.["email"] === input.email.trim().toLowerCase();
  if (!paid) {
    return {
      ok: false,
      reason:
        s.payment_status !== "paid"
          ? "Payment isn't confirmed yet. Finish checkout in the Stripe tab, then try again."
          : "This payment doesn't match this order (service or email differs).",
    };
  }
  return { ok: true, sessionId: s.id };
}

/** Claim a paid session once. Returns false if it was already used. */
export async function claimSession(sessionId: string, tier: TierId, email: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("payment_redemptions").insert({
    session_id: sessionId,
    tier,
    amount_cents: TIER_PRICING[tier].cents,
    email: email.trim().toLowerCase(),
  });
  if (!error) return true;
  if (error.code === "23505") {
    // Already claimed: allow a retry only if the earlier build never delivered.
    const { data } = await supabaseAdmin
      .from("payment_redemptions")
      .select("status")
      .eq("session_id", sessionId)
      .maybeSingle();
    return data?.status === "building";
  }
  console.error("redemption insert failed", error.code);
  throw new Error("We couldn't record your payment. Try again.");
}

export async function markDelivered(sessionId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("payment_redemptions")
    .update({ status: "delivered", updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}
