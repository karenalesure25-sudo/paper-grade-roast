import type { OrderRow } from "./engine";

/** The original snapshot survives worker retries and document revisions without re-grading. */
export function originalRoastForDelivery(order: Pick<OrderRow, "snapshot" | "status" | "paid_at" | "result">) {
  const roast = order.snapshot.originalRoast;
  return order.status === "ready" && order.paid_at && order.result && roast?.persona === order.snapshot.roastPersona ? roast ?? null : null;
}
