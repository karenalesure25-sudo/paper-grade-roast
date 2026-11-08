import { z } from "zod";

export const PersonaIdSchema = z.enum(["fashion-bestie", "crypto-bro", "corporate-demon"]);
export type PersonaId = z.infer<typeof PersonaIdSchema>;

/** Public copy only. Backend style instructions live exclusively in .server.ts. */
export const ROAST_PERSONAS = [
  { id: "fashion-bestie", emoji: "💅", name: "The Career Bestie", description: "Bestie, we’re about to find out if your résumé is giving CEO energy or clearance rack.", preview: "Babe, let’s give those bullet points a promotion-worthy outfit." },
  { id: "crypto-bro", emoji: "🚀", name: "Hypebeast Crypto Bro", description: "Bro, is your résumé going to the moon or getting liquidated?", preview: "Bro, let’s get your experience off the bench and into the starting lineup." },
  { id: "corporate-demon", emoji: "💀", name: "The Corporate Demon", description: "Your résumé has entered the HR department. Good luck.", preview: "Your bullet points have been invited to a mandatory performance review." },
] as const satisfies ReadonlyArray<{ id: PersonaId; emoji: string; name: string; description: string; preview: string }>;

const PREFERENCE_KEY = "kcs.roast-persona.v1";
export function readPersona(): PersonaId | null {
  try { const p = PersonaIdSchema.safeParse(window.localStorage.getItem(PREFERENCE_KEY)); return p.success ? p.data : null; } catch { return null; }
}
export function savePersona(persona: PersonaId) {
  try { window.localStorage.setItem(PREFERENCE_KEY, PersonaIdSchema.parse(persona)); } catch { /* Optional preference only. */ }
}

export const PersonalitySectionsSchema = z.object({
  vibe: z.string().trim().min(1).max(400),
  redFlags: z.array(z.string().trim().min(1).max(320)).max(3),
  glowUp: z.string().trim().min(1).max(500),
  rewrite: z.object({ before: z.string().trim().min(6).max(200), after: z.string().trim().min(6).max(400) }).strict().nullable(),
  ats: z.string().trim().min(1).max(500),
  signOff: z.string().trim().min(1).max(300),
}).strict();
export type PersonalitySections = z.infer<typeof PersonalitySectionsSchema>;
