import { describe, expect, test } from "bun:test";
import { recommendService, selectedService } from "./service-recommendation";
import { formatCustomerTime } from "./customer-time";
import { checkModelOutput } from "./roast.server";

const answers = { hasResume: true, goal: "polish", coverLetter: false, targetRole: "", jobDescription: "" };

describe("service guidance", () => {
  test("general rewrite recommends the $40 service", () => {
    expect(recommendService(answers)?.tier).toBe("revamp");
  });
  test("no resume recommends scratch even when a cover letter is requested", () => {
    const result = recommendService({ ...answers, hasResume: false, coverLetter: true });
    expect(result?.tier).toBe("scratch");
    expect(result?.reason).toContain("does not include a cover letter");
  });
  test("job targeting and cover-letter requests recommend the bundle", () => {
    expect(recommendService({ ...answers, goal: "target" })?.tier).toBe("bundle");
    expect(recommendService({ ...answers, coverLetter: true })?.tier).toBe("bundle");
  });
  test("incomplete or invalid answers produce no recommendation", () => {
    expect(recommendService({ ...answers, hasResume: undefined })).toBe(null);
    expect(recommendService({ ...answers, goal: "unknown" })).toBe(null);
  });
  test("a recommendation cannot silently replace a selected service", () => {
    recommendService({ ...answers, goal: "target" });
    expect(selectedService("revamp")).toBe("revamp");
    expect(selectedService("revamp", "bundle")).toBe("bundle");
  });
});

describe("Central Time", () => {
  test("winter uses CST", () => {
    const value = formatCustomerTime("2026-01-15T18:00:00Z");
    expect(value).toContain("12:00 PM CST");
  });
  test("summer uses CDT", () => {
    expect(formatCustomerTime("2026-07-15T18:00:00Z")).toContain("1:00 PM CDT");
  });
  test("invalid timestamps are not displayed", () => {
    expect(formatCustomerTime("not a date")).toBe("");
  });
});

describe("malformed grading output", () => {
  const result = { is_resume: true, rubric: { clarity: 4, impact: 4, specificity: 4, structure: 4, completeness: 4 }, strengths: [], weaknesses: [], roast: "Clear writing.", tip: "Keep your achievements specific.", tip_quote: "Clear writing" };
  test("missing rubric values cannot become default scores", () => {
    expect(checkModelOutput(JSON.stringify({ ...result, rubric: { clarity: 4 } }), "Clear writing", "text").ok).toBe(false);
  });
  test("out-of-range and string scores are rejected", () => {
    for (const clarity of [5, -1, "4", 2.5]) {
      expect(checkModelOutput(JSON.stringify({ ...result, rubric: { ...result.rubric, clarity } }), "Clear writing", "text").ok).toBe(false);
    }
  });
});
