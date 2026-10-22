/**
 * Customer notifications for orders. I/O is injected so tests exercise the exact logic.
 * - confirmation: only after server-verified payment (paid_at set)
 * - ready: only when the order is ready with a validated result
 * Claims are leased in the database; success flags are written only after an accepted send.
 * No customer PII is logged — only order id, kind and an error code.
 */
import { getTier } from "../products";
import { formatCustomerTime } from "../customer-time";
import type { OrderRow } from "./engine";
import type { OrderEmailName } from "../order-emails/templates";

export type NotificationKind = "confirmation" | "ready";
export const MAX_NOTIFY_ATTEMPTS = 6;

export type EmailMessage = {
  template: OrderEmailName;
  to: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
};

export type EmailResult =
  | { status: "sent" }
  | { status: "suppressed" }
  | { status: "unconfigured" }
  | { status: "retry"; code: string; retryAfterSeconds?: number | null }
  | { status: "permanent"; code: string };

export type EmailPort = {
  /** False until the sender domain is verified and the managed sender is wired in. */
  available(): boolean;
  send(msg: EmailMessage): Promise<EmailResult>;
};

export type NotificationState = {
  done?: boolean; outcome?: "sent" | "suppressed"; sentAt?: string;
  attempts?: number; nextAt?: string; lastCode?: string; gaveUp?: boolean;
};

export type NotifyRepo = {
  byId(id: string): Promise<OrderRow | null>;
  /** Atomic leased claim; returns a unique fencing token, or null if done, exhausted, backing off, or claimed elsewhere. */
  claim(id: string, kind: NotificationKind): Promise<string | null>;
  /** Merges patch and releases the claim only if `token` still owns it; false when a newer claim superseded it. */
  finish(id: string, kind: NotificationKind, token: string, patch: NotificationState): Promise<boolean>;
};

export function backoffSeconds(attempts: number, retryAfter?: number | null): number {
  if (retryAfter && retryAfter > 0) return Math.min(retryAfter, 3600);
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 3600);
}

export function eligible(order: OrderRow, kind: NotificationKind): boolean {
  if (!order.paid_at) return false;
  if (kind === "ready") return order.status === "ready" && Boolean(order.result);
  return true;
}

export function buildMessage(order: OrderRow, kind: NotificationKind, origin: string): EmailMessage {
  const packageName = getTier(order.tier)?.name ?? "your package";
  const base = {
    firstName: order.snapshot.name.split(/\s+/)[0] ?? "",
    packageName,
    orderUrl: `${origin}/orders/${order.access_token}`,
    ...(order.expires_at ? { expires: formatCustomerTime(order.expires_at) } : {}),
  };
  if (kind === "confirmation") {
    return { template: "order-confirmation", to: order.email, data: base, idempotencyKey: `order-confirmation-${order.id}` };
  }
  return {
    template: "order-ready", to: order.email,
    data: { ...base, hasCoverLetter: Boolean(order.result?.coverLetter) },
    idempotencyKey: `order-ready-${order.id}`,
  };
}

export type NotifyOutcome = "sent" | "suppressed" | "unconfigured" | "busy" | "not_eligible" | "retry" | "gave_up";

export async function deliverNotification(
  repo: NotifyRepo, port: EmailPort, orderId: string, kind: NotificationKind, origin: string, now = () => new Date(),
): Promise<NotifyOutcome> {
  // Without a verified sender nothing is claimed, so no attempts are consumed.
  if (!port.available()) return "unconfigured";
  const token = await repo.claim(orderId, kind);
  if (!token) return "busy";
  const finish = async (patch: NotificationState) => {
    if (!(await repo.finish(orderId, kind, token, token, patch))) console.error("order email claim superseded", { orderId, kind });
  };
  const order = await repo.byId(orderId);
  if (!order || !eligible(order, kind)) {
    await finish({});
    return "not_eligible";
  }
  const state = ((order as OrderRow & { notifications?: Record<string, NotificationState> }).notifications?.[kind]) ?? {};
  const attempts = (state.attempts ?? 0) + 1;
  let result: EmailResult;
  try {
    result = await port.send(buildMessage(order, kind, origin));
  } catch {
    result = { status: "retry", code: "send_threw" };
  }
  if (result.status === "sent" || result.status === "suppressed") {
    await finish({ done: true, outcome: result.status, sentAt: now().toISOString(), attempts });
    return result.status;
  }
  if (result.status === "unconfigured") {
    await finish({});
    return "unconfigured";
  }
  const exhausted = result.status === "permanent" || attempts >= MAX_NOTIFY_ATTEMPTS;
  if (exhausted) {
    console.error("order email gave up", { orderId, kind, code: result.code });
    await finish({ attempts: MAX_NOTIFY_ATTEMPTS, gaveUp: true, lastCode: result.code });
    return "gave_up";
  }
  const wait = backoffSeconds(attempts, result.status === "retry" ? result.retryAfterSeconds : null);
  await finish({ attempts, lastCode: result.code, nextAt: new Date(now().getTime() + wait * 1000).toISOString() });
  return "retry";
}
