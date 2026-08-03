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
    price: 25,
    tagline: "You have a résumé. It needs a red pen and a rewrite.",
    intake: "resume",
    includes: [
      "Every bullet rewritten in your voice",
      "Quantified impact where you had none",
      "ATS-safe formatting, no broken columns",
      "Your pick of three templates",
    ],
    cta: "Start My Revamp",
  },
  {
    id: "scratch",
    name: "Résumé From Scratch",
    price: 35,
    tagline: "No résumé yet? Tell us the story and we write it.",
    intake: "background",
    includes: [
      "Written from your raw background",
      "Summary, objective, and bullets built for you",
      "Skills section mined from your experience",
      "Your pick of three templates",
    ],
    cta: "Start From Scratch",
  },
  {
    id: "bundle",
    name: "Bundle Package",
    price: 55,
    tagline: "The rewrite, then tailored to one real job and submitted for you.",
    intake: "resume+job",
    includes: [
      "Everything in the Résumé Revamp",
      "Tailored to a job posting you send us",
      "Keyword match against that exact listing",
      "We submit the application on your behalf",
    ],
    cta: "Start My Bundle",
  },
];

export function getTier(id: string): Tier | undefined {
  return TIERS.find((tier) => tier.id === id);
}
