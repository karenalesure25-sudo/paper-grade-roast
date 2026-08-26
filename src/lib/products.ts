/** The three paid tiers. Each has its own flow at /order/$tier. */
export type TierId = "revamp" | "scratch" | "bundle";

export type Tier = {
  id: TierId;
  name: string;
  price: number;
  tagline: string;
  /** What the buyer hands us at the start of the flow. */
  intake: "resume" | "background" | "resume+job";
  includes: string[];
  /** Copy for the button that starts this tier. */
  cta: string;
};

export const TIERS: Tier[] = [
  {
    id: "revamp",
    name: "Resume Revamp",
    price: 40,
    tagline: "You have a résumé. It needs a red pen and a rewrite.",
    intake: "resume",
    includes: [
      "Every bullet rewritten in your voice",
      "Quantified impact where you had none",
      "ATS-safe formatting, no broken columns",
      "Your pick of every template",
    ],
    cta: "Start My Revamp",
  },
  {
    id: "scratch",
    name: "Résumé From Scratch",
    price: 50,
    tagline: "No résumé yet? Tell us the story and we build it from the ground up.",
    intake: "background",
    includes: [
      "Written from your raw background",
      "Summary, objective, and bullets built for you",
      "Skills section mined from your experience",
      "Your pick of every template",
    ],
    cta: "Start From Scratch",
  },
  {
    id: "bundle",
    name: "Revamp + ATS Optimization",
    price: 60,
    tagline:
      "The full rewrite, optimized for the robots, tailored to one real job, plus a cover letter.",
    intake: "resume+job",
    includes: [
      "Everything in the Résumé Revamp",
      "ATS optimization and keyword matching",
      "Tailored to the specific job or role you send us",
      "A matching professional cover letter",
    ],
    cta: "Start My ATS Rewrite",
  },
];

export function getTier(id: string): Tier | undefined {
  return TIERS.find((tier) => tier.id === id);
}
