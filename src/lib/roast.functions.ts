import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { gradeAnySource } from "./roast-pipeline.server";
import { RoastInput } from "./roast-input";

export type { RoastResult } from "./roast-pipeline.server";

export const roastResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RoastInput.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { ROAST_OWNER_COOKIE, newRoastOwner, issueRoastReceipt } = await import("./roast-receipt.server");
    const cookie = getCookie(ROAST_OWNER_COOKIE);
    const owner = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : newRoastOwner();
    setCookie(ROAST_OWNER_COOKIE, owner, { httpOnly: true, secure: new URL(getRequest().url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 86400 });
    const result = await gradeAnySource(data);
    if (result.status !== "graded" || !result.persona || !result.personality) return result;
    const receipt = await issueRoastReceipt({ grade: result.grade, notes: result.notes, persona: result.persona, personality: result.personality, label: result.label }, owner);
    return { ...result, receipt };
  });
