import type { ResumeData } from "./resume-templates";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SHAPE = `{"name":"","title":"","location":"","email":"","phone":"","summary":"","objective":"","experience":[{"company":"","role":"","location":"","dates":"","bullets":[""]}],"education":[{"school":"","credential":"","dates":""}],"skills":[""]}`;

const BASE_RULES = `You are the résumé writer behind "Callback". You produce clean, ATS-safe,
recruiter-ready résumé content. Never invent employers, job titles, dates, schools,
credentials, or metrics that are not supported by the input. If a number is not given,
write a strong bullet without inventing one. Keep bullets to one line each, start with a
strong verb, and cut buzzwords ("synergy", "hard worker", "detail oriented" as a claim).
Aim for 3-5 bullets per recent role and 2-3 for older ones. Skills: 6-10 concrete items.
If contact details are missing from the input, leave those fields as empty strings.

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

Task: rewrite and polish the résumé you are given. Keep every real fact, but rewrite
every line so it reads sharper and quantifies impact where the input supports it.`,
  scratch: `${BASE_RULES}

Task: the input is raw background notes, not a résumé. Write a complete résumé from it.
Infer a sensible target job title from the experience described.`,
  bundle: `${BUNDLE_RULES}

Task: rewrite the résumé, optimize it for Applicant Tracking Systems, AND tailor it to
the job or role supplied. Mirror the posting's exact language, titles, and priorities in
the title, summary, objective, and bullets, without fabricating experience. Order skills
so the posting's required skills come first and use the posting's own keywords verbatim
where they honestly apply. Then write the matching cover letter.`,
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

export type WrittenOrder = { resume: ResumeData; coverLetter?: string };

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
    return coverLetter ? { resume, coverLetter } : { resume };
  }

  return { resume: coerceResume(parsed) };
}
