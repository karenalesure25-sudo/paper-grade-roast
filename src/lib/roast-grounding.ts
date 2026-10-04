/**
 * Pure, deterministic helpers that keep the roast grounded in the actual résumé
 * text. No network, no I/O — unit-tested in roast-grounding.test.ts.
 */

export const MAX_SOURCE_CHARS = 24000;
export const MIN_READABLE_CHARS = 200;
export const MIN_READABLE_WORDS = 40;

export type SourceKind = "pdf" | "docx" | "text";

/** Lowercased, punctuation-normalized form used for quote matching. */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2022\u25CF\u25AA\u25A0\u2023\u2043\u00B7\u25E6]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Display-safe cleanup of extracted text (keeps case and line breaks). */
export function cleanSource(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
}

export type Readability = { ok: true } | { ok: false; reason: string };

/** Is there enough real text to grade? Unreadable ≠ bad résumé. */
export function checkReadable(text: string): Readability {
  const t = text.trim();
  if (t.length < MIN_READABLE_CHARS) {
    return { ok: false, reason: "We could only read a few characters from this file." };
  }
  const words = t.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w));
  if (words.length < MIN_READABLE_WORDS) {
    return { ok: false, reason: "We couldn't find enough readable words in this file." };
  }
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (letters / t.length < 0.45) {
    return { ok: false, reason: "The text in this file came out garbled." };
  }
  return { ok: true };
}

export type SectionId =
  | "contact_email"
  | "contact_phone"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "metrics";

/** Deterministic presence checks. Missing-section claims must agree with these. */
export function detectSections(text: string): Record<SectionId, boolean> {
  const n = normalize(text);
  return {
    contact_email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(n),
    contact_phone: /(\+?\d[\d\s().-]{8,}\d)/.test(n),
    summary: /\b(summary|profile|objective|about me)\b/.test(n),
    experience: /\b(experience|employment|work history|professional background)\b/.test(n),
    education: /\b(education|university|college|degree|diploma|b\.?s\.?|b\.?a\.?|bachelor|master|ged|high school)\b/.test(n),
    skills: /\b(skills|competencies|proficiencies|technologies|tools)\b/.test(n),
    metrics: /(\d+(\.\d+)?\s?%|\$\s?\d|\b\d{2,}[,\d]*\+?\s?(clients|customers|patients|users|people|employees|staff|accounts|tickets|calls|orders|projects|students|members|units|sales|hours)\b|\b(increased|reduced|grew|cut|saved|improved)\b[^.]{0,40}\d)/.test(
      n,
    ),
  };
}

export const SECTION_LABEL: Record<SectionId, string> = {
  contact_email: "an email address",
  contact_phone: "a phone number",
  summary: "a summary",
  experience: "a work experience section",
  education: "an education section",
  skills: "a skills section",
  metrics: "numbers or measurable results",
};

/** Words that imply we saw the visual document. We only ever see text. */
const VISUAL_CLAIMS =
  /\b(font|fonts|typeface|colou?rs?|layout|columns?|margins?|white ?space|page length|(one|two|three|four|five|\d+)[- ]pages?|graphics?|icons?|headshot|photo|bold(ed)?|italics?|spacing|design|visually|looks? (cluttered|crowded|clean))\b/i;

/** Claims about real ATS outcomes we cannot know. */
const ATS_OUTCOME_CLAIMS =
  /\b(ats (score|will|would|rejects?|filters?)|(will|would) (be )?(rejected|filtered|auto-?rejected)|passes? (the )?ats|fails? (the )?ats|\d+% ats)\b/i;

export function hasUnsupportedClaim(text: string): string | null {
  if (VISUAL_CLAIMS.test(text)) return "visual/formatting claim (only text was read)";
  if (ATS_OUTCOME_CLAIMS.test(text)) return "claim about a real ATS outcome";
  return null;
}

export type Rubric = {
  clarity: number;
  impact: number;
  specificity: number;
  structure: number;
  completeness: number;
};

export function clampRubric(r: Partial<Record<keyof Rubric, unknown>>): Rubric {
  const c = (v: unknown) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0;
  };
  return {
    clarity: c(r.clarity),
    impact: c(r.impact),
    specificity: c(r.specificity),
    structure: c(r.structure),
    completeness: c(r.completeness),
  };
}

/** Grade is derived from the rubric, never chosen freely. Total is 0–20. */
export function gradeFromRubric(r: Rubric): "A" | "B" | "C" | "D" | "F" {
  const total = r.clarity + r.impact + r.specificity + r.structure + r.completeness;
  if (total >= 17) return "A";
  if (total >= 13) return "B";
  if (total >= 9) return "C";
  if (total >= 5) return "D";
  return "F";
}

export type RawEvidenceItem = { point?: unknown; quote?: unknown; missing?: unknown };

export type Evidence = { point: string; quote: string | null; missing: SectionId | null };

const SECTION_IDS: SectionId[] = [
  "contact_email",
  "contact_phone",
  "summary",
  "experience",
  "education",
  "skills",
  "metrics",
];

/** Does this quote exist verbatim (after normalization) in the source? */
export function quoteInSource(quote: string, normalizedSource: string): boolean {
  const q = normalize(quote).replace(/^["'.\s]+|["'.\s]+$/g, "");
  if (q.length < 6 || q.length > 200) return false;
  return normalizedSource.includes(q);
}

export type VerifyResult = { kept: Evidence[]; rejected: string[] };

/**
 * Keep only items backed by a verbatim quote OR a missing-section claim that the
 * deterministic detector agrees with. Every item must also avoid visual/ATS claims.
 */
export function verifyEvidence(
  items: RawEvidenceItem[],
  normalizedSource: string,
  sections: Record<SectionId, boolean>,
  maxPointChars: number,
): VerifyResult {
  const kept: Evidence[] = [];
  const rejected: string[] = [];
  for (const item of items.slice(0, 6)) {
    const point = typeof item.point === "string" ? item.point.trim() : "";
    const quote = typeof item.quote === "string" && item.quote.trim() ? item.quote.trim() : null;
    const missing =
      typeof item.missing === "string" && SECTION_IDS.includes(item.missing as SectionId)
        ? (item.missing as SectionId)
        : null;
    if (!point || point.length > maxPointChars) {
      rejected.push("empty or overlong point");
      continue;
    }
    const bad = hasUnsupportedClaim(point);
    if (bad) {
      rejected.push(`"${point}": ${bad}`);
      continue;
    }
    if (quote) {
      if (!quoteInSource(quote, normalizedSource)) {
        rejected.push(`quote not found in résumé: "${quote.slice(0, 80)}"`);
        continue;
      }
      kept.push({ point, quote, missing: null });
      continue;
    }
    if (missing) {
      if (sections[missing]) {
        rejected.push(`claimed ${missing} is missing but it is present`);
        continue;
      }
      kept.push({ point, quote: null, missing });
      continue;
    }
    rejected.push(`"${point}": no quote or verifiable missing-section evidence`);
  }
  return { kept, rejected };
}

/** Points that say "missing X" / "no X" must be backed by detector agreement. */
export function textClaimsMissing(text: string, sections: Record<SectionId, boolean>): string | null {
  const n = normalize(text);
  const checks: Array<[RegExp, SectionId]> = [
    [/\bno (email|e-mail)\b|missing (an )?email/, "contact_email"],
    [/\bno phone\b|missing (a )?phone/, "contact_phone"],
    [/\bno (summary|objective|profile)\b|missing (a )?(summary|objective)/, "summary"],
    [/\bno (education|degree)\b|missing (an )?education/, "education"],
    [/\bno skills\b|missing (a )?skills/, "skills"],
    [/\bno (numbers|metrics|measurable)\b|zero (numbers|metrics)|not (a |one |single )?(number|metric)/, "metrics"],
  ];
  for (const [re, id] of checks) {
    if (re.test(n) && sections[id]) return `says ${id} is missing but it is present`;
  }
  return null;
}
