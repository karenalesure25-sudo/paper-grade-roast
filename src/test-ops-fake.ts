import { mock } from "bun:test";

/** In-memory stand-in for src/lib/ops/ops.server (test-only; loaded via bunfig preload). */
export const opsFake = { gate: "closed" as "closed" | "probe" | "open", trips: [] as string[], oks: 0 };
(globalThis as { __opsFake?: typeof opsFake }).__opsFake = opsFake;

const fake = {
  aiGate: async () => opsFake.gate,
  noteGatewayOk: async () => { opsFake.oks++; },
  tripOutage: async (code: string) => { opsFake.trips.push(code); opsFake.gate = "open"; },
  expireOpenCheckouts: async () => 0,
  heartbeat: async () => undefined,
  checkoutAvailability: async () => ({ ok: true as const }),
  raiseAlert: async () => undefined,
  ownerAlertConfigured: () => false,
  flushOwnerAlerts: async () => [] as string[],
};
mock.module("@/lib/ops/ops.server", () => fake);
mock.module(new URL("./lib/ops/ops.server.ts", import.meta.url).pathname, () => fake);
