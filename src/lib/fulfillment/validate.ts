/**
 * Pure, deterministic release checks for paid deliverables. No I/O.
 * Every generated package must pass these (plus an independent model fact-check)
 * before any file is released. Failures are reported, never silently "fixed":
 * nothing here truncates or drops content.
 */
import { normalize, unsupportedNumbers } from "../roast-grounding";
import type { ResumeData } from "../resume-templates";
import type { TierId } from "../products";

export const LIMITS = {
  name: 100, title: 120, location: 100, email: 160, phone: 60,
  summary: 1200, objective: 800, company: 140, role: 140, dates: 60,
  bullet: 320, bullets: 10, roles: 15, education: 8, school: 160, credential: 160,
  skills: 30, skill: 80, certifications: 15, certification: 160,
  coverLetterMin: 150, coverLetterMax: 550,
} as const;

export type Certification = { name: string; issuer: string; dates: string };
export type FullResume = ResumeData & { certifications: Certification[] };

export type KeywordRow = { keyword: string; inSource: boolean; inResume: boolean };
export type KeywordReport = {
  /** Share of posting keywords the delivered résumé contains. An estimate, not an ATS score. */
  estimatedCoverage: number;
  rows: KeywordRow[];
  note: string;
};

export type Package = {
  resume: FullResume;
  coverLetter?: string;
  keywordReport?: KeywordReport;
};

/** Immutable facts the writer may use. Job-posting text is NOT included. */
export type SourceFacts = {
  tier: TierId;
  /** Extracted résumé text or the structured intake rendered as text, plus clarifications. */
  text: string;
  name: string;
  email: string;
  phone: string;
  /** $50 only: the customer's stated target title may be used as the headline. */
  targetTitle?: string;
  /** Structured items that must survive into the résumé ($50). */
  requiredEmployers: string[];
  requiredSchools: string[];
  requiredCertifications: string[];
  /** $60 only. */
  job?: { text: string; company: string; title: string };
};

const STOP = new Set([
  "and", "the", "of", "for", "in", "at", "to", "a", "an", "with", "on", "&", "inc", "llc", "ltd", "co",
  "corp", "corporation", "company", "present", "current", "now",
]);

function tokens(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.]+|[.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

const MONTHS: Record<string, string> = {
  january: "jan", february: "feb", march: "mar", april: "apr", june: "jun", july: "jul",
  august: "aug", september: "sep", sept: "sep", october: "oct", november: "nov", december: "dec",
};
function canonToken(t: string): string {
  return MONTHS[t] ?? t;
}

/** True when every significant token of `value` appears in `source` (order-insensitive). */
export function grounded(value: string, source: string): boolean {
  const need = tokens(value).map(canonToken);
  if (need.length === 0) return true;
  const have = new Set(tokens(source).map(canonToken));
  return need.every((t) => have.has(t));
}

/** Whole-phrase presence, used for keywords. */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const h = ` ${normalize(haystack).replace(/[^a-z0-9+#]+/g, " ")} `;
  const p = normalize(phrase).replace(/[^a-z0-9+#]+/g, " ").trim();
  return p.length > 0 && h.includes(` ${p} `);
}

const PLACEHOLDER =
  /\[[^\]]{0,60}\]|\{\{|\}\}|<[a-z ]+>|lorem ipsum|your name|company name|hiring manager name|\btbd\b|\btba\b|\bxx+\b|\b0{3,}\b|insert |n\/a\b|example\.com|555-0|\bjohn doe\b|\bjane doe\b/i;

export function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value);
}

/** Text that is a document instruction rather than résumé content. */
const INJECTION =
  /(ignore (all|any|previous|prior) (instructions|rules)|system prompt|as an ai\b|you are (chatgpt|an ai)|grade (this|me) (an )?a\b|assistant:)/i;

export type Violation = { code: string; detail: string };

function check(cond: boolean, out: Violation[], code: string, detail: string) {
  if (!cond) out.push({ code, detail });
}

/** Every text field the buyer will see, flattened, for document-wide checks. */
export function resumeProse(r: FullResume): string {
  return [
    r.title, r.location, r.summary, r.objective,
    ...r.experience.flatMap((e) => [e.company, e.role, e.location, e.dates, ...e.bullets]),
    ...r.education.flatMap((e) => [e.school, e.credential, e.dates]),
    ...r.skills,
    ...r.certifications.flatMap((c) => [c.name, c.issuer, c.dates]),
  ].join("\n");
}

function years(text: string): Set<string> {
  return new Set(normalize(text).match(/\b(19[5-9]\d|20[0-4]\d)\b/g) ?? []);
}

/**
 * Deterministic schema + grounding + completeness checks. Returns every violation
 * (empty array ⇒ deterministic checks passed).
 */
export function validatePackage(pkg: Package, facts: SourceFacts): Violation[] {
  const v: Violation[] = [];
  const r = pkg.resume;
  const src = facts.text;

  // Identity comes from the intake verbatim.
  check(r.name === facts.name, v, "name", "Résumé name must match the intake name exactly.");
  check(r.email === facts.email, v, "email", "Résumé email must match the intake email.");
  check(r.phone === facts.phone, v, "phone", "Résumé phone must match the intake phone.");

  // Schema completeness and limits (reject — never truncate).
  const over = (val: string, max: number, label: string) =>
    check(val.length <= max, v, "too_long", `${label} exceeds ${max} characters.`);
  over(r.title, LIMITS.title, "Title");
  over(r.location, LIMITS.location, "Location");
  over(r.summary, LIMITS.summary, "Summary");
  over(r.objective, LIMITS.objective, "Objective");
  check(r.summary.trim().length >= 60, v, "summary", "Summary is missing or too thin.");
  check(r.experience.length >= 1, v, "experience", "At least one experience entry is required.");
  check(r.experience.length <= LIMITS.roles, v, "too_long", "Too many experience entries.");
  check(r.skills.length >= 3 && r.skills.length <= LIMITS.skills, v, "skills", "Skills list must have 3–30 items.");

  r.experience.forEach((e, i) => {
    const label = `Experience #${i + 1}`;
    check(Boolean(e.company.trim() && e.role.trim()), v, "experience", `${label} needs employer and title.`);
    check(e.bullets.length >= 1, v, "experience", `${label} has no bullets.`);
    check(e.bullets.length <= LIMITS.bullets, v, "too_long", `${label} has too many bullets.`);
    over(e.company, LIMITS.company, `${label} employer`);
    over(e.role, LIMITS.role, `${label} title`);
    over(e.dates, LIMITS.dates, `${label} dates`);
    e.bullets.forEach((b) => over(b, LIMITS.bullet, `${label} bullet`));
    check(grounded(e.company, src), v, "invented_employer", `Employer "${e.company}" isn't in the source.`);
    check(grounded(e.role, src), v, "invented_title", `Job title "${e.role}" isn't in the source.`);
    if (e.dates.trim()) check(grounded(e.dates, src), v, "invented_dates", `Dates "${e.dates}" aren't in the source.`);
    if (e.location.trim()) check(grounded(e.location, src), v, "invented_location", `Location "${e.location}" isn't in the source.`);
  });
  r.education.forEach((e, i) => {
    over(e.school, LIMITS.school, `Education #${i + 1}`);
    over(e.credential, LIMITS.credential, `Education #${i + 1}`);
    check(grounded(e.school, src), v, "invented_school", `School "${e.school}" isn't in the source.`);
    if (e.credential.trim()) check(grounded(e.credential, src), v, "invented_degree", `Credential "${e.credential}" isn't in the source.`);
    if (e.dates.trim()) check(grounded(e.dates, src), v, "invented_dates", `Dates "${e.dates}" aren't in the source.`);
  });
  check(r.certifications.length <= LIMITS.certifications, v, "too_long", "Too many certifications.");
  r.certifications.forEach((c) => {
    over(c.name, LIMITS.certification, "Certification");
    check(grounded(c.name, src), v, "invented_certification", `Certification "${c.name}" isn't in the source.`);
    if (c.issuer.trim()) check(grounded(c.issuer, src), v, "invented_certification", `Issuer "${c.issuer}" isn't in the source.`);
  });
  r.skills.forEach((s) => {
    over(s, LIMITS.skill, "Skill");
    check(grounded(s, src), v, "invented_skill", `Skill/tool "${s}" isn't supported by the source.`);
  });
  if (r.location.trim()) check(grounded(r.location, src), v, "invented_location", "Location isn't in the source.");
  if (r.title.trim()) {
    const okTitle = grounded(r.title, src) || (facts.targetTitle ? grounded(r.title, facts.targetTitle) : false);
    check(okTitle, v, "invented_title", `Headline "${r.title}" isn't a title from the source.`);
  }

  // Metrics: every number in the delivered prose must come from the source.
  const prose = resumeProse(r) + "\n" + (pkg.coverLetter ?? "");
  for (const n of unsupportedNumbers(prose, src)) {
    v.push({ code: "invented_metric", detail: `Number "${n}" isn't in the source.` });
  }

  // Placeholders and leaked document instructions.
  check(!hasPlaceholder(prose) && !hasPlaceholder(r.name), v, "placeholder", "Output contains placeholder text.");
  check(!INJECTION.test(prose), v, "injection", "Output repeats instructions found inside the document.");

  // Completeness: nothing from the source may be silently dropped.
  const outYears = years(resumeProse(r));
  for (const y of years(src)) {
    check(outYears.has(y), v, "omitted", `The source mentions ${y}, but no entry in the résumé covers it.`);
  }
  const outAll = resumeProse(r);
  for (const e of facts.requiredEmployers) check(grounded(e, outAll), v, "omitted", `Employer "${e}" was dropped.`);
  for (const s of facts.requiredSchools) check(grounded(s, outAll), v, "omitted", `School "${s}" was dropped.`);
  for (const c of facts.requiredCertifications) check(grounded(c, outAll), v, "omitted", `Certification "${c}" was dropped.`);

  // Tier-specific deliverables.
  if (facts.tier === "bundle") {
    const letter = pkg.coverLetter ?? "";
    const words = letter.trim().split(/\s+/).filter(Boolean).length;
    const paras = letter.split(/\n\s*\n/).filter((p) => p.trim()).length;
    check(Boolean(letter.trim()), v, "cover_letter", "Cover letter is missing.");
    check(words >= LIMITS.coverLetterMin, v, "cover_letter", "Cover letter is too short to be complete.");
    check(words <= LIMITS.coverLetterMax, v, "too_long", "Cover letter is too long.");
    check(paras >= 3, v, "cover_letter", "Cover letter needs at least 3 paragraphs.");
    check(/^\s*dear\b/i.test(letter), v, "cover_letter", "Cover letter needs a salutation.");
    check(letter.trim().endsWith(facts.name), v, "cover_letter", "Cover letter must close with the candidate's name.");
    if (facts.job?.company) check(containsPhrase(letter, facts.job.company), v, "cover_letter", "Cover letter doesn't name the company.");
    check(Boolean(pkg.keywordReport), v, "keywords", "Keyword comparison is missing.");
    // Job-post requirements are not candidate facts.
    for (const row of pkg.keywordReport?.rows ?? []) {
      if (!row.inSource && (containsPhrase(outAll, row.keyword) || containsPhrase(letter, row.keyword))) {
        v.push({ code: "job_requirement_as_fact", detail: `"${row.keyword}" comes from the job posting, not the candidate's background.` });
      }
    }
  } else {
    check(!pkg.coverLetter, v, "scope", "Only the $60 package includes a cover letter.");
  }
  return v;
}

/**
 * Transparent keyword comparison. Keywords are kept only when they literally appear
 * in the posting; presence is computed deterministically, never by the model.
 */
export function buildKeywordReport(candidates: string[], jobText: string, sourceText: string, resume: FullResume): KeywordReport {
  const seen = new Set<string>();
  const rows: KeywordRow[] = [];
  const out = resumeProse(resume);
  for (const raw of candidates) {
    const k = raw.trim();
    const key = normalize(k);
    if (!k || k.length > 60 || seen.has(key) || !containsPhrase(jobText, k)) continue;
    seen.add(key);
    rows.push({ keyword: k, inSource: containsPhrase(sourceText, k), inResume: containsPhrase(out, k) });
  }
  const covered = rows.filter((r) => r.inResume).length;
  return {
    estimatedCoverage: rows.length ? Math.round((covered / rows.length) * 100) : 0,
    rows,
    note:
      "Estimated keyword coverage: the share of keywords from the posting that appear in your résumé. Keywords missing from your background were not added. This is an estimate, not a guaranteed ATS score.",
  };
}

/** Essential facts we refuse to guess. Returns customer-facing questions. */
export function missingEssentials(facts: SourceFacts): string[] {
  const q: string[] = [];
  const words = facts.text.split(/\s+/).filter(Boolean).length;
  if (words < 60) q.push("We couldn't read enough of your résumé. Please paste the full text of your work history (employers, job titles, dates and what you did).");
  if (years(facts.text).size === 0) q.push("Please add the dates (month/year or year) for each job and your education.");
  if (facts.tier === "bundle" && (!facts.job || facts.job.text.trim().split(/\s+/).length < 40)) {
    q.push("Please paste the full job description for the one job this package is tailored to.");
  }
  return q;
}
