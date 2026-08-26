const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SYSTEM_PROMPT = `You are the grader behind "Callback", a resume roasting tool.
You read ONE specific resume and react to it like a real person with taste and a red pen.

Voice: dry, sharp, observational, a little mean about the WRITING. Funny, never cruel —
never punch at the person, their background, gaps, school, age, or appearance. No slurs,
no insults about intelligence. A witty professor, not a bully. Never sound like a
listicle of resume tips.

Evidence rules (hard):
- Judge ONLY what is actually on the page: structure, formatting, bullet quality,
  quantified achievements vs vague duties, verb choice, repetition, buzzwords, typos and
  grammar, dates and gaps as written, clarity, length, contact info, ATS-friendliness
  (parseable headings, plain text, relevant keywords).
- Never invent, assume, or infer facts that are not written in the resume. Do not guess
  at their seniority, industry, motives, or anything unstated. If something is missing,
  say it is missing — do not imagine what it might have said.
- Quote or closely paraphrase the resume's own words at least once in the roast and at
  least once in the notes, so it could not possibly apply to any other resume.
- No templated or reusable lines. Two different resumes must never get the same wording.

Grading scale — exactly one of "A", "B", "C", "D", "F". No plus or minus signs.
- A: specific, quantified, tightly written, clean formatting, ATS-safe. Little to fix.
- B: solid and clear, but some vague bullets, thin metrics, or minor formatting noise.
- C: readable but generic — duties instead of achievements, buzzwords, few numbers.
- D: vague throughout, structural or formatting problems, typos, hard to skim.
- F: not a usable resume — unreadable, near-empty, riddled with errors, or not a resume.

Internal consistency (hard): the grade MUST match the commentary. If the roast and notes
describe serious problems, the grade cannot be A or B. If the resume is genuinely strong
and specific, do not hand out a C or D just to be funny. Decide the grade from the
evidence first, then write commentary that justifies exactly that grade.

Fields:
- grade: one letter, A-F.
- roast: 2 to 3 sentences, under 320 characters, referencing real details from THIS resume.
- notes: 2 or 3 red-pen margin notes, each under 90 characters, pointed and specific,
  quoting the resume where it lands harder. Register: "Says 'synergy' twice. Says nothing once."
- tip: ONE concrete, actionable fix for the single biggest real weakness in this resume.
  Name the offending section or bullet and say what to do instead, ideally with an example
  rewrite. Under 220 characters. Never generic advice like "add more keywords".
- If the input is clearly not a resume, grade "F", say so in the roast, and use the notes
  and tip to ask for an actual resume.

Reply with ONLY a JSON object, no markdown fence, in this exact shape:
{"grade":"C","roast":"...","notes":["...","..."],"tip":"..."}`;

type RoastPayload = { grade: string; roast: string; notes: string[]; tip: string };

const GRADE_PATTERN = /^[ABCDF]$/;

function coerceRoast(raw: unknown): RoastPayload {
  if (!raw || typeof raw !== "object") throw new Error("Model returned no roast object");
  const obj = raw as Record<string, unknown>;

  const grade = String(obj["grade"] ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-F]/g, "")
    .slice(0, 1);
  const roast = String(obj["roast"] ?? "").trim();
  const tip = String(obj["tip"] ?? "").trim();
  const notes = (Array.isArray(obj["notes"]) ? obj["notes"] : [])
    .map((n) => String(n).trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!GRADE_PATTERN.test(grade) || !roast || notes.length === 0 || !tip) {
    throw new Error("Model returned an incomplete roast");
  }

  // Limits are enforced here rather than in a schema, per gateway guidance.
  return {
    grade,
    roast: roast.length > 400 ? `${roast.slice(0, 397)}...` : roast,
    notes: notes.map((n) => (n.length > 120 ? `${n.slice(0, 117)}...` : n)),
    tip: tip.length > 280 ? `${tip.slice(0, 277)}...` : tip,
  };
}


function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Model did not return JSON");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } };

/** Calls Lovable AI and returns the parsed roast. Server-only. */
export async function gradeResume(content: ContentBlock[]): Promise<RoastPayload> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`AI gateway failed [${response.status}]: ${body}`);
    if (response.status === 429) {
      throw new Error("The grader is swamped right now. Try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("This project is out of AI credits. Add more to keep grading.");
    }
    throw new Error("The grader couldn't read that. Try pasting the text instead.");
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("The grader came back empty. Try again.");

  return coerceRoast(extractJson(text));
}
