import { createServerFn } from "@tanstack/react-start";
import { SubmitIntakeInput } from "./intake-schema";
import { storeIntake } from "./intake.server";

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmitIntakeInput.parse(input))
  .handler(async ({ data }) => storeIntake(data));
