import { z } from "zod";
import type { TierId } from "./products";

export const ServiceAnswers = z.object({
  hasResume: z.boolean(),
  goal: z.enum(["polish", "target"]),
  coverLetter: z.boolean(),
  targetRole: z.string().trim().max(120),
  jobDescription: z.string().trim().max(24000),
});
export type ServiceAnswers = z.infer<typeof ServiceAnswers>;

export function recommendService(input: unknown): { tier: TierId; reason: string } | null {
  const result = ServiceAnswers.safeParse(input);
  if (!result.success) return null;
  const a = result.data;
  if (!a.hasResume) return { tier: "scratch", reason: "We’ll build your résumé from your background. This service does not include a cover letter." };
  if (a.goal === "target" || a.coverLetter) return { tier: "bundle", reason: "Your résumé will be tailored to one job, with a matching cover letter. The full job description or a posting file is required before checkout." };
  return { tier: "revamp", reason: "A professional rewrite of your existing résumé, without tailoring it to a particular posting." };
}

/** Only an explicit choice can replace the currently selected product. */
export function selectedService(current: TierId, explicitChoice?: TierId): TierId {
  return explicitChoice ?? current;
}