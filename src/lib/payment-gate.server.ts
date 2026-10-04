/**
 * Server-only payment gate for paid deliverables.
 *
 * Default OFF: there is no payment provider connected, so no order can be verified
 * as paid. When a real provider is added, replace this with a lookup of a
 * provider-verified payment record (e.g. from a signed webhook) for the order.
 * Do NOT gate on env flags, query params, or anything the browser sends.
 */
export async function hasVerifiedPayment(): Promise<boolean> {
  return false;
}
