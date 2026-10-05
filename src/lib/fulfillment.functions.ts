import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const Token = z.string().uuid();

/** Snapshot the saved intake and open Stripe Checkout bound to that order. */
export const startOrderCheckout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ intakeId: z.string().uuid(), template: z.string().trim().min(1).max(40), photo: z.string().max(900_000).optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { createOrderCheckout } = await import("./fulfillment/service.server");
    const origin = new URL(getRequest().url).origin;
    return createOrderCheckout({ ...data, origin });
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token }).parse(i))
  .handler(async ({ data }) => {
    const { statusByToken } = await import("./fulfillment/service.server");
    return statusByToken(data.token);
  });

/** Nudges processing for a paid order. Claim-guarded server-side; harmless to repeat. */
export const nudgeOrder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token }).parse(i))
  .handler(async ({ data }) => {
    const { runByToken } = await import("./fulfillment/service.server");
    return runByToken(data.token);
  });

export const answerOrderQuestions = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token, text: z.string().trim().min(5).max(6000) }).parse(i))
  .handler(async ({ data }) => {
    const { clarifyByToken } = await import("./fulfillment/service.server");
    return clarifyByToken(data.token, data.text);
  });

export const retryOrder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token }).parse(i))
  .handler(async ({ data }) => {
    const { retryByToken } = await import("./fulfillment/service.server");
    return retryByToken(data.token);
  });
