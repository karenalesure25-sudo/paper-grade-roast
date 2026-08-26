import type { ResumeData } from "./resume-templates";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SHAPE = `{"name":"","title":"","location":"","email":"","phone":"","summary":"","objective":"","experience":[{"company":"","role":"","location":"","dates":"","bullets":[""]}],"education":[{"school":"","credential":"","dates":""}],"skills":[""]}`;

const BASE_RULES = `You are the senior résumé strategist behind "Kay’s Career Solutions". You produce polished,
ATS-safe, recruiter-ready résumé content that sounds professional and current. Never invent employers,
job titles, dates, schools, credentials, certifications, tools, licenses, or metrics that are not supported
by the input. If a number is not given, write a strong achievement/responsibility bullet without inventing one.

Rewrite standard for paid orders:
- Do not copy the original summary, objective, skills phrasing, or bullet sentences unless it is a proper noun,
  credential, employer name, job title, date, location, email, or phone number.
- Preserve the buyer's facts, but transform weak/plain wording into stronger professional language.
- Every experience bullet must be freshly rewritten with a strong action verb, clearer scope, and business value.
- Remove filler and buzzwords ("synergy", "hard worker", "detail oriented" as a claim).
- Use concise, confident verbiage a hiring manager would expect; no jokes, no roast language, no placeholders.
- Keep bullets to one line each where possible. Aim for 3-5 bullets per recent role and 2-3 for older ones.
- Skills: 6-10 concrete, job-relevant items.
- If contact details are missing from the input, leave those fields as empty strings.

Reply with ONLY a JSON object, no markdown fence, in this exact shape:
${SHAPE}`;

const ATS_SHAPE = `{"score":0,"verdict":"","matched":[{"keyword":"","where":""}],"missing":[{"keyword":"","why":""}],"factors":[{"label":"","points":0,"detail":""}]}`;

const BUNDLE_RULES = BASE_RULES.replace(
  `Reply with ONLY a JSON object, no markdown fence, in this exact shape:
${SHAPE}`,
  `Reply with ONLY a JSON object, no markdown fence, in this exact shape:
{"resume":${SHAPE},"coverLetter":"","atsReport":${ATS_SHAPE}}

"coverLetter" is a complete, professional cover letter for that exact job: 3-4 short
paragraphs, plain text with \\n\\n between paragraphs, no placeholders in brackets, no
invented facts, addressed generically ("Dear Hiring Manager") if no name is given.

"atsReport" scores the résumé you just wrote against the supplied job posting:
- "score": integer 0-100, an honest estimate of how well an ATS screen would rank it.
  Base it only on evidence in the résumé and posting, never on optimism.
- "verdict": 1-2 sentences explaining that number in plain language.
- "matched": 6-12 keywords/skills from the posting that genuinely appear in the résumé.
  "where" names the exact section or role the ATS would find it in (e.g. "Summary",
  "Skills", "Operations Lead bullets").
- "missing": 2-5 posting keywords the résumé does NOT honestly support. "why" says why
  it is absent (not in the candidate's history, no evidence given, etc.). Never fabricate
  the résumé to cover these; report them.
- "factors": 3-5 scoring factors, each with "label", a signed integer "points"
  contribution, and "detail" tying it to the posting (e.g. keyword coverage, title
  alignment, quantified impact, formatting parseability).
Every explanation must reference the actual posting and résumé, no generic filler.`,
);

export const PROMPTS = {
  revamp: `${BASE_RULES}

Task: perform a full professional résumé revamp. Keep every real fact, but rewrite the document so it no
longer reads like the original. Replace passive/basic wording with polished professional verbiage, sharpen
the summary/objective, reorganize skills, and rewrite every bullet for stronger impact. Do not return copied
sentences from the uploaded résumé.`,
  scratch: `${BASE_RULES}

Task: the input is raw background notes, not a résumé. Write a complete résumé from it.
Infer a sensible target job title from the experience described.`,
  bundle: `${BUNDLE_RULES}

Task: perform a full professional résumé revamp, optimize it for Applicant Tracking Systems, AND tailor it
to the job or role supplied. Use the provided job posting text/link/file as the target. Mirror the posting's
exact language, role priorities, required skills, and keywords in the title, summary, objective, skills, and
bullets only where the buyer's background honestly supports them. Reorder and rewrite content so the most
relevant experience appears strongest for that exact role. Do not return copied résumé sentences. Then write
the matching cover letter.`,
} as const;

export type OrderKind = keyof typeof PROMPTS;

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } };

function str(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function coerceResume(raw: unknown): ResumeData {
  if (!raw || typeof raw !== "object") throw new Error("The writer returned nothing usable.");
  const obj = raw as Record<string, unknown>;

  const experience = (Array.isArray(obj["experience"]) ? obj["experience"] : [])
    .slice(0, 6)
    .map((entry) => {
      const job = (entry ?? {}) as Record<string, unknown>;
      return {
        company: str(job["company"], 120),
        role: str(job["role"], 120),
        location: str(job["location"], 80),
        dates: str(job["dates"], 60),
        bullets: (Array.isArray(job["bullets"]) ? job["bullets"] : [])
          .map((b) => str(b, 240))
          .filter(Boolean)
          .slice(0, 6),
      };
    })
    .filter((job) => job.company || job.role);

  const education = (Array.isArray(obj["education"]) ? obj["education"] : [])
    .slice(0, 4)
    .map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return {
        school: str(item["school"], 120),
        credential: str(item["credential"], 120),
        dates: str(item["dates"], 60),
      };
    })
    .filter((item) => item.school || item.credential);

  const resume: ResumeData = {
    name: str(obj["name"], 100) || "Your Name Here",
    title: str(obj["title"], 100),
    location: str(obj["location"], 100),
    email: str(obj["email"], 120),
    phone: str(obj["phone"], 60),
    summary: str(obj["summary"], 900),
    objective: str(obj["objective"], 700),
    experience,
    education,
    skills: (Array.isArray(obj["skills"]) ? obj["skills"] : [])
      .map((s) => str(s, 60))
      .filter(Boolean)
      .slice(0, 12),
  };

  if (!resume.summary || resume.experience.length === 0) {
    throw new Error("The writer couldn't build a résumé from that. Add more detail.");
  }
  return resume;
}

function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The writer did not return JSON.");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function hostnameIsBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  const parts = host.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first = 0, second = 0] = parts;
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    );
  }

  return host.includes(":");
}

function htmlToReadableText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Reads public job-posting pages so link-only $60 orders can be truly tailored. */
export async function fetchJobPostingText(jobUrl: string): Promise<string | undefined> {
  let url: URL;
  try {
    url = new URL(jobUrl);
  } catch {
    return undefined;
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    return undefined;
  }
  if (hostnameIsBlocked(url.hostname)) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8",
        "user-agent": "KayCareerSolutionsBot/1.0",
      },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;

    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/json")
    ) {
      return undefined;
    }

    const raw = (await response.text()).slice(0, 200_000);
    const readable = contentType.includes("text/html") ? htmlToReadableText(raw) : raw.replace(/\s+/g, " ").trim();
    return readable.length >= 120 ? readable.slice(0, 12_000) : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export type AtsReport = {
  score: number;
  verdict: string;
  matched: Array<{ keyword: string; where: string }>;
  missing: Array<{ keyword: string; why: string }>;
  factors: Array<{ label: string; points: number; detail: string }>;
};

function coerceAtsReport(raw: unknown): AtsReport | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;

  const rawScore = Number(obj["score"]);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 0;

  const list = (key: string) => (Array.isArray(obj[key]) ? (obj[key] as unknown[]) : []);

  const matched = list("matched")
    .slice(0, 14)
    .map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return { keyword: str(item["keyword"], 80), where: str(item["where"], 160) };
    })
    .filter((item) => item.keyword);

  const missing = list("missing")
    .slice(0, 8)
    .map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return { keyword: str(item["keyword"], 80), why: str(item["why"], 240) };
    })
    .filter((item) => item.keyword);

  const factors = list("factors")
    .slice(0, 6)
    .map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const points = Number(item["points"]);
      return {
        label: str(item["label"], 80),
        points: Number.isFinite(points) ? Math.round(points) : 0,
        detail: str(item["detail"], 300),
      };
    })
    .filter((item) => item.label);

  const verdict = str(obj["verdict"], 600);
  if (!verdict && matched.length === 0 && factors.length === 0) return undefined;

  return { score, verdict, matched, missing, factors };
}

export type WrittenOrder = {
  resume: ResumeData;
  coverLetter?: string;
  atsReport?: AtsReport;
};

/**
 * Calls Lovable AI and returns structured résumé content. The bundle tier also
 * returns a tailored cover letter. Server-only.
 */
export async function writeResume(
  kind: OrderKind,
  content: ContentBlock[],
): Promise<WrittenOrder> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: PROMPTS[kind] },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`AI gateway failed [${response.status}]: ${body}`);
    if (response.status === 429) {
      throw new Error("The writers' room is swamped. Try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("This project is out of AI credits. Add more to keep writing.");
    }
    throw new Error("The writer couldn't read that file. Try a different export.");
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("The writer came back empty. Try again.");

  const parsed = extractJson(text);

  if (kind === "bundle") {
    const obj = (parsed ?? {}) as Record<string, unknown>;
    const resume = coerceResume(obj["resume"] ?? parsed);
    const coverLetter = str(obj["coverLetter"], 6000);
    const atsReport = coerceAtsReport(obj["atsReport"]);
    return {
      resume,
      ...(coverLetter ? { coverLetter } : {}),
      ...(atsReport ? { atsReport } : {}),
    };
  }

  return { resume: coerceResume(parsed) };
}
