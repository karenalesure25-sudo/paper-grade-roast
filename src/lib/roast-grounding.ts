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
    .trim();
}

/** Never grade a partial résumé: overlong extracted text is rejected, not truncated. */
export function checkLength(text: string): Readability {
  if (text.length > MAX_SOURCE_CHARS) {
    return {
      ok: false,
      reason: `This résumé came out to ${text.length.toLocaleString("en-US")} characters of text, over our ${MAX_SOURCE_CHARS.toLocaleString("en-US")}-character limit. We don't grade partial résumés — remove extra pages or paste a shorter version.`,
    };
  }
  return { ok: true };
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

const COUNT_WORDS =
  "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|hundreds|thousand|thousands|dozen|dozens|million|millions|billion";
const COUNT_NOUNS =
  "clients?|customers?|patients?|users?|people|employees?|staff|members?|accounts?|tickets?|calls?|orders?|projects?|students?|units?|sales|hours|stores?|locations?|sites?|teams?|reports?|vendors?|cases?|events?|products?|applications?|campaigns?|interns?|agents?|engineers?|volunteers?|facilities|warehouses?|departments?|shifts?|beds?|courses?|classes?|properties|homes?|vehicles?|machines?|systems?|servers?|releases?|features?|languages?|countries|states|regions|partners?|deals?|contracts?|leads?|hires?|direct reports?";

/** Measurable results: %, money, any count of a countable thing (digits or words), "Nx", verbs + numbers. */
const METRIC_RE = new RegExp(
  [
    String.raw`\d+(\.\d+)?\s?%`,
    String.raw`[$£€]\s?\d`,
    String.raw`\b\d+(\.\d+)?\s?(k|m|mm|b)\b`,
    String.raw`\b\d+(\.\d+)?x\b`,
    String.raw`\b\d[\d,]*\+?\s?(-\s?)?(${COUNT_NOUNS})\b`,
    String.raw`\b(${COUNT_WORDS})\s(${COUNT_NOUNS})\b`,
    String.raw`\b(team|staff|crew|group) of (\d+|${COUNT_WORDS})\b`,
    String.raw`\b(increased|reduced|grew|cut|saved|improved|decreased|boosted|raised|lowered|generated|delivered|processed|handled|managed|trained|led|supervised|resolved|closed)\b[^.\n]{0,50}\b(\d+|${COUNT_WORDS})\b`,
    String.raw`\bfrom \d[\d,.]*\s?%? to \d`,
  ].join("|"),
);

/** Deterministic presence checks. Missing-section claims must agree with these. */
export function detectSections(text: string): Record<SectionId, boolean> {
  const n = normalize(text);
  return {
    contact_email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(n),
    contact_phone: /(\+?\d[\d\s().-]{8,}\d)/.test(n),
    summary: /\b(summary|profile|objective|about me|overview|introduction|personal statement)\b/.test(n),
    experience:
      /\b(experience|employment|work history|career history|professional background|career|positions held|work)\b/.test(n) ||
      /\b(19|20)\d{2}\s?-\s?((19|20)\d{2}|present|current|now)\b/.test(n),
    education:
      /\b(education|academic|university|universit[a-z]+|college|school|institute|academy|polytechnic|degree|diploma|bachelor'?s?|master'?s?|doctorate|ph\.?\s?d|mba|ged|high school|associate'?s? (degree|of)|b\.?\s?(s|a|sc|tech|e|eng|com|ba)\b\.?|m\.?\s?(s|a|sc|tech|e|eng|ba)\b\.?|a\.?a\.?s\b|bsn|msn|coursework|graduated|graduate|alumn[a-z]*|certificate program|vocational)\b/.test(n),
    skills: /\b(skills?|competenc(y|ies)|proficienc(y|ies)|technologies|tools|qualifications|expertise|core expertise|strengths|toolkit|tech stack|software|languages|certifications?)\b/.test(n),
    metrics: METRIC_RE.test(n),
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
    const bad = hasUnsupportedClaim(point) ?? textClaimsMissing(point, sections);
    if (bad) {
      rejected.push(`"${point}": ${bad}`);
      continue;
    }
    if (quote) {
      if (!quoteInSource(quote, normalizedSource)) {
        rejected.push(`quote not found in résumé: "${quote.slice(0, 80)}"`);
        continue;
      }
      const contra = pointContradictsQuote(point, quote);
      if (contra) {
        rejected.push(`"${point}": ${contra}`);
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
    [/\bno (education|degree|schooling)\b|missing (an |the )?(education|degree)|without (an? )?(education|degree)|education (is )?(missing|absent)/, "education"],
    [/\bno (work )?(experience|job history|work history|employment)\b|missing (the )?(experience|work history)/, "experience"],
    [/\bno skills\b|missing (a |the )?skills|skills (section )?(is )?(missing|absent)/, "skills"],
    [/\bno (numbers|metrics|measurable|quantified|results)\b|zero (numbers|metrics|results)|not (a |one |single )?(number|metric)|without (any )?(numbers|metrics)|lacks? (any )?(numbers|metrics|quantif)|unquantified|no quantif/, "metrics"],
  ];
  for (const [re, id] of checks) {
    if (re.test(n) && sections[id]) return `says ${id} is missing but it is present`;
  }
  return null;
}

/** A point that says "no numbers" must not be paired with a quote that has numbers, etc. */
export function pointContradictsQuote(point: string, quote: string): string | null {
  const p = normalize(point);
  const q = normalize(quote);
  const saysNoMetrics =
    /\b(no|zero|lacks?|without|missing|absent)\b[^.]{0,20}\b(numbers?|metrics?|measur|quantif|results?|data)/.test(p) ||
    /unquantified|not quantified/.test(p);
  if (saysNoMetrics && (METRIC_RE.test(q) || /\d/.test(q))) return "says there are no numbers but the quote contains one";
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

/**
 * Every number in free prose (roast/tip) must appear in the résumé, as digits or as the
 * spelled-out word. Catches "Three jobs" on a two-job résumé, and invented metrics.
 * "zero"/"one"/"single" are allowed as rhetorical. Conservative: unknown ⇒ reject.
 */
export function unsupportedNumbers(prose: string, source: string): string[] {
  const p = normalize(prose);
  const n = normalize(source);
  const bad: string[] = [];
  for (const m of p.match(/\d[\d,.]*%?/g) ?? []) {
    const core = m.replace(/[.,]+$/, "");
    if (!n.includes(core)) bad.push(core);
  }
  const jobCount = (n.match(/\b(19|20)\d{2}\s?-\s?((19|20)\d{2}|present|current|now)\b/g) ?? []).length;
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(p)) {
      // "Two jobs" is allowed only when the résumé has exactly that many dated entries.
      const jobRef = new RegExp(`\\b${word} (jobs|roles|positions|employers|gigs)\\b`).test(p);
      if (jobRef) {
        if (val !== jobCount) bad.push(word);
        continue;
      }
      const asWord = new RegExp(`\\b${word}\\b`).test(n);
      const asDigit = new RegExp(`(^|[^\\d.,])${val}([^\\d]|$)`).test(n);
      if (!asWord && !asDigit) bad.push(word);
    }
  }
  return bad;
}

/** Harsh language that can't sit next to an A or B. */
export const SEVERE_NEGATIVE =
  /\b(disaster|terrible|awful|dreadful|trainwreck|train wreck|mess|hopeless|zero (results|outcomes|impact)|nothing (of value|here)|worst|embarrassing|painful|fortune cookie|duty list|generic|forgettable|unreadable|weak|vague)\b/i;
