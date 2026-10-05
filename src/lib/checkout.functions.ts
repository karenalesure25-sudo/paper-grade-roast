import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const Input = z.object({
  tier: z.enum(["revamp", "scratch", "bundle"]),
  email: z.string().trim().email().max(255),
});

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { createCheckoutSession } = await import("./stripe.server");
    const origin = new URL(getRequest().url).origin;
    const s = await createCheckoutSession({ ...data, origin });
    if (!s.url) throw new Error("Checkout couldn't start. Try again.");
    return { sessionId: s.id, url: s.url };
  });
