import { z } from "zod";
import { PersonaIdSchema, PersonalitySectionsSchema } from "./roast-personas";

const EvidenceSchema = z.object({
  point: z.string().max(140), quote: z.string().max(120).nullable(),
  missing: z.enum(["contact_email", "contact_phone", "summary", "experience", "education", "skills", "metrics"]).nullable(),
}).strict();

/** The original verified free roast, kept separate from paid application documents. */
export const DeliveredRoastSchema = z.object({
  grade: z.enum(["A", "B", "C", "D", "F"]),
  persona: PersonaIdSchema,
  personality: PersonalitySectionsSchema,
  notes: z.array(EvidenceSchema).max(3),
  label: z.string().min(1).max(200),
}).strict().refine((r) => r.notes.length === r.personality.redFlags.length);
export type DeliveredRoast = z.infer<typeof DeliveredRoastSchema>;
