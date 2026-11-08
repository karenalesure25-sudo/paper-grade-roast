import { afterEach, expect, test } from "bun:test";
import { checkModelOutput, gradeResumeText } from "./roast.server";

const source = `Synthetic Candidate
synthetic@example.invalid | 202-555-0100
SUMMARY
Operations coordinator specializing in inventory accuracy and team scheduling.
EXPERIENCE
Operations Coordinator | Example Company | 2023–2025
- Organized weekly schedules for a team of 8 using Excel.
- Reduced inventory entry errors by 20% using Excel validation rules.
- Compiled weekly stock reports for the operations manager.
PROJECTS
- Built an Excel spreadsheet to track stock levels and flag missing entries.
EDUCATION
Associate Degree in Business Administration | Example College | 2023
SKILLS
Excel, inventory tracking, scheduling, data validation`;
const raw = {
  is_resume: true, rubric: { clarity: 4, impact: 3, specificity: 3, structure: 4, completeness: 4 },
  strengths: [{ point: "A concrete method and result.", quote: "Reduced inventory entry errors by 20% using Excel validation rules.", missing: null }],
  weaknesses: [], roast: "The Excel validation result is damn clear.", roast_quote: "Reduced inventory entry errors by 20% using Excel validation rules.",
  tip: "Optional polish: lead with the inventory improvement.", tip_quote: "Reduced inventory entry errors by 20% using Excel validation rules.",
};
const oldFetch = globalThis.fetch;
const oldKey = process.env["LOVABLE_API_KEY"];
afterEach(() => { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env["LOVABLE_API_KEY"]; else process.env["LOVABLE_API_KEY"] = oldKey; });

test("the existing 140-character evidence limit rejects 141 characters with an exact field diagnosis", () => {
  const result = checkModelOutput(JSON.stringify({ ...raw, weaknesses: [{ point: "x".repeat(141), quote: "Compiled weekly stock reports for the operations manager.", missing: null }] }), source, "text");
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Overlong evidence accepted");
  expect(result.feedback).toContain("weaknesses.0.point too_big max 140");
});

test("the neutral request schema communicates existing evidence limits without changing its rubric or verification", async () => {
  process.env["LOVABLE_API_KEY"] = "synthetic-test-only";
  let calls = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    if (typeof init?.body !== "string") throw new Error("Missing body");
    const body = JSON.parse(init.body); calls++;
    if (body.text.format.name === "roast") {
      expect(body.text.format.schema.$defs.item.properties.point).toEqual({ type: "string", minLength: 1, maxLength: 140 });
      expect(body.text.format.schema.$defs.item.properties.quote).toEqual({ type: ["string", "null"], minLength: 6, maxLength: 120 });
      expect(body.model).toBe("openai/gpt-6-astra");
    }
    const text = body.text.format.name === "roast" ? JSON.stringify(raw) : JSON.stringify({ approved: true, reasons: [] });
    return new Response(`data: ${JSON.stringify({ type: "response.output_text.done", text })}\n\n`);
  }) as typeof fetch;
  const result = await gradeResumeText(source, "text");
  expect(result.status).toBe("graded");
  if (result.status !== "graded") throw new Error("Fixture rejected");
  expect(result.grade).toBe("A"); expect(calls).toBe(2);
});