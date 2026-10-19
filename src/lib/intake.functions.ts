import { createServerFn } from "@tanstack/react-start";
import { SubmitIntakeInput } from "./intake-schema";
import { storeIntake } from "./intake.server";
import { getRequest, setCookie } from "@tanstack/react-start/server";

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmitIntakeInput.parse(input))
  .handler(async ({ data }) => {
    const result = await storeIntake(data);
    setCookie(`kcs-intake-${data.tier}`, result.id, { httpOnly: true, secure: new URL(getRequest().url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 86400 });
    return result;
  });
