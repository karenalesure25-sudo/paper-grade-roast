const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SYSTEM_PROMPT = `You are the grader behind "Callback", a resume roasting tool.
You read a resume and return a grade, a short roast, and specific weak points.

Voice: dry, sharp, observational. Funny but never cruel — punch at the writing,
never at the person, their background, gaps, school, or appearance. No slurs, no
insults about intelligence. Think a witty professor with a red pen, not a bully.

Rules:
- grade: a single letter grade from "A" to "F", optionally with + or - (e.g. "B-", "C+", "A").
  Grade honestly: vague buzzword resumes land C or below; quantified, specific ones earn B+ or better.
- roast: 2 to 3 sentences, under 320 characters total. Reference actual details from the
  resume so it never reads like a generic template.
- notes: 2 or 3 specific weak points, each written like a red-pen note scribbled in the
  margin. Very short (under 90 characters), imperative or pointed. Quote the resume's own
  words when that lands harder. Examples of the register: "Says 'synergy' twice. Says nothing once."
  or "Six bullets, zero numbers."
- If the input is clearly not a resume, set grade to "F", say so in the roast, and use the
  notes to ask for an actual resume.

Reply with ONLY a JSON object, no markdown fence, in this exact shape:
{"grade":"C+","roast":"...","notes":["...","..."]}`;

type RoastPayload = { grade: string; roast: string; notes: string[] };

const GRADE_PATTERN = /^[A-F][+-]?$/;

function coerceRoast(raw: unknown): RoastPayload {
  if (!raw || typeof raw !== "object") throw new Error("Model returned no roast object");
  const obj = raw as Record<string, unknown>;

  const grade = String(obj["grade"] ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const roast = String(obj["roast"] ?? "").trim();
  const notes = (Array.isArray(obj["notes"]) ? obj["notes"] : [])
    .map((n) => String(n).trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!GRADE_PATTERN.test(grade) || !roast || notes.length === 0) {
    throw new Error("Model returned an incomplete roast");
  }

  // Limits are enforced here rather than in a schema, per gateway guidance.
  return {
    grade,
    roast: roast.length > 400 ? `${roast.slice(0, 397)}...` : roast,
    notes: notes.map((n) => (n.length > 120 ? `${n.slice(0, 117)}...` : n)),
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
