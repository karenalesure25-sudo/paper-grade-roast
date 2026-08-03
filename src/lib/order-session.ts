import type { OrderResult } from "./order.functions";
import type { TemplateId } from "./resume-templates";
import type { TierId } from "./products";

const KEY = "callback.orders.v1";

export type StoredOrder = {
  id: string;
  createdAt: number;
  tier: TierId;
  template: TemplateId;
  /** Placeholder checkout: no real money moves yet. */
  paid: boolean;
  /** Bundle only: set once the application has been queued for submission. */
  submissionQueued?: boolean;
  result: OrderResult;
};

function read(): StoredOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredOrder[]) : [];
  } catch {
    return [];
  }
}

function write(orders: StoredOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(orders.slice(0, 10)));
  } catch {
    /* session storage full or blocked — the order still lives in component state */
  }
}

export function saveOrder(
  order: Omit<StoredOrder, "id" | "createdAt">,
): StoredOrder {
  const stored: StoredOrder = {
    ...order,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  write([stored, ...read()]);
  return stored;
}

export function updateOrder(id: string, patch: Partial<StoredOrder>): StoredOrder | null {
  const orders = read();
  const index = orders.findIndex((order) => order.id === id);
  if (index === -1) return null;
  const next = { ...orders[index]!, ...patch };
  orders[index] = next;
  write(orders);
  return next;
}

export function readOrders(): StoredOrder[] {
  return read();
}
