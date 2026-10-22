import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const Token = z.string().uuid();

/** Snapshot the saved intake and open Stripe Checkout bound to that order. */
export const startOrderCheckout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ intakeId: z.string().uuid(), template: z.string().trim().min(1).max(40), photo: z.string().max(900_000).optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { createOrderCheckout } = await import("./fulfillment/service.server");
    const url = new URL(getRequest().url);
    const origin = url.origin;
    const { checkoutModeFor } = await import("./fulfillment/stripe-mode");
    // Preview hosts with a test key use Stripe test mode; the published site is always live.
    const mode = checkoutModeFor(url.host, Boolean(process.env["STRIPE_TEST_SECRET_KEY"]));
    const result = await createOrderCheckout({ ...data, origin, mode });
    setCookie("kcs-order", result.token, { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 86400 });
    return result;
  });

/** Opaque HttpOnly capabilities only; never persist résumé/photo in browser storage. */
export const recoverOrderProgress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ tier: z.enum(["revamp", "scratch", "bundle"]).optional() }).parse(i))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { recoverProgress } = await import("./fulfillment/service.server");
    return recoverProgress(data.tier, data.tier ? getCookie(`kcs-intake-${data.tier}`) : undefined, getCookie("kcs-order"));
  });

export const resumeOrderCheckout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token }).parse(i))
  .handler(async ({ data }) => {
    const { resumeCheckout } = await import("./fulfillment/service.server");
    return resumeCheckout(data.token, new URL(getRequest().url).origin);
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

/** Lost-link recovery: generic response, rate-limited, links go only to the address on file. */
export const requestOrderLinks = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().min(3).max(254) }).parse(i))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const req = getRequest();
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const { recoverOrderLinks } = await import("./fulfillment/service.server");
    return recoverOrderLinks(data.email, ip);
  });

export const getEmailAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { emailDeliveryActive } = await import("./fulfillment/service.server");
  return { active: emailDeliveryActive() };
});

const RevisionId = z.string().uuid();

export const requestOrderRevision = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    token: Token, kind: z.enum(["minor", "correction"]), text: z.string().trim().min(10).max(1500),
    idem: z.string().regex(/^[A-Za-z0-9-]{8,80}$/),
  }).parse(i))
  .handler(async ({ data }) => {
    const { requestRevisionByToken } = await import("./fulfillment/service.server");
    try {
      return await requestRevisionByToken(data.token, data.kind, data.text, data.idem);
    } catch {
      return { ok: false as const, message: "We couldn’t submit that right now. Nothing was used up — please try again.", status: null };
    }
  });

export const answerRevisionQuestion = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token, id: RevisionId, text: z.string().trim().min(10).max(1500) }).parse(i))
  .handler(async ({ data }) => {
    const { answerRevisionByToken } = await import("./fulfillment/service.server");
    return answerRevisionByToken(data.token, data.id, data.text);
  });

export const retryOrderRevision = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token, id: RevisionId }).parse(i))
  .handler(async ({ data }) => {
    const { retryRevisionByToken } = await import("./fulfillment/service.server");
    return retryRevisionByToken(data.token, data.id);
  });

export const nudgeOrderRevision = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Token, id: RevisionId }).parse(i))
  .handler(async ({ data }) => {
    const { runRevisionByToken } = await import("./fulfillment/service.server");
    return runRevisionByToken(data.token, data.id);
  });
