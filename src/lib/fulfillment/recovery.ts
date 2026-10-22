/**
 * Lost-link recovery. Always answers with the same generic message (non-enumerating),
 * rate-limits by hashed email and hashed IP, and emails links only to the address on file.
 */
import { getTier } from "../products";
import type { EmailPort } from "./notify";

export const RECOVERY_LIMITS = { perEmailPerHour: 3, perIpPerHour: 10 };
export const GENERIC_RECOVERY_MESSAGE = "If we have orders for that email, we've sent their private links to it. Check your inbox and spam folder.";

export type RecoveryOrder = { access_token: string; tier: string; status: string };
export type RecoveryDeps = {
  hash(value: string): Promise<string>;
  countRecent(emailHash: string, ipHash: string): Promise<{ email: number; ip: number }>;
  record(emailHash: string, ipHash: string): Promise<void>;
  ordersFor(email: string): Promise<RecoveryOrder[]>;
  port: EmailPort;
  origin: string;
  now?: () => Date;
};

export type RecoveryResult =
  | { ok: true; message: string }
  | { ok: false; reason: "unavailable" | "invalid" | "rate_limited"; message: string };

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment", queued: "Payment confirmed", processing: "In progress",
  needs_information: "Needs your details", ready: "Ready", failed: "Needs attention",
};

export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export async function requestOrderLinks(emailInput: string, ip: string, deps: RecoveryDeps): Promise<RecoveryResult> {
  if (!deps.port.available()) {
    return { ok: false, reason: "unavailable", message: "Email delivery isn't switched on yet, so we can't resend links. Use the private order link from your checkout confirmation page." };
  }
  const email = normalizeEmail(emailInput);
  if (!email) return { ok: false, reason: "invalid", message: "Enter a valid email address." };
  const [eh, ih] = await Promise.all([deps.hash(`email:${email}`), deps.hash(`ip:${ip || "unknown"}`)]);
  const counts = await deps.countRecent(eh, ih);
  if (counts.email >= RECOVERY_LIMITS.perEmailPerHour || counts.ip >= RECOVERY_LIMITS.perIpPerHour) {
    return { ok: false, reason: "rate_limited", message: "Too many requests. Please wait an hour and try again." };
  }
  await deps.record(eh, ih);
  const orders = (await deps.ordersFor(email)).slice(0, 5);
  if (orders.length) {
    const hour = Math.floor((deps.now?.() ?? new Date()).getTime() / 3600_000);
    try {
      await deps.port.send({
        template: "order-links", to: email,
        data: { orders: orders.map((o) => ({ packageName: getTier(o.tier)?.name ?? "Order", url: `${deps.origin}/orders/${o.access_token}`, status: STATUS_LABEL[o.status] ?? "Saved" })) },
        idempotencyKey: `order-links-${eh.slice(0, 24)}-${hour}`,
      });
    } catch {
      console.error("order link recovery send failed");
    }
  }
  // Same response whether or not orders exist.
  return { ok: true, message: GENERIC_RECOVERY_MESSAGE };
}
