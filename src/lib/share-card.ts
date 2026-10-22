/**
 * Share-card copy. Built ONLY from the letter grade, so a shared image can never carry
 * résumé quotes, names, employers or contact details. The full roast stays on-screen only.
 */
import type { LetterGrade } from "./roast-grounding";
import { PUBLIC_SITE_ORIGIN } from "./site";

export const SHARE_QUIPS: Record<LetterGrade, string> = {
  A: "My résumé took a red pen to the face and walked away with an A. Damn right.",
  B: "Solid B. Strong bones, a few bullets that need to stop mumbling.",
  C: "A C. My résumé is doing the bare minimum and honestly? Relatable.",
  D: "A D. My résumé is technically employed and spiritually on vacation.",
  F: "An F. My résumé just got roasted harder than a cheap coffee bean. Rewrite incoming.",
};

export const SHARE_URL = `${PUBLIC_SITE_ORIGIN}/roast`;
export const SHARE_DISPLAY_URL = SHARE_URL.replace(/^https:\/\//, "");

export function shareCopy(grade: LetterGrade) {
  return {
    grade,
    quip: SHARE_QUIPS[grade],
    cta: "Get your free résumé roast",
    url: SHARE_URL,
    displayUrl: SHARE_DISPLAY_URL,
    text: `${SHARE_QUIPS[grade]} Get yours: ${SHARE_URL}`,
  };
}
