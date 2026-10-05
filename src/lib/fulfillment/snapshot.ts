/** Pure builders for the immutable source snapshot taken before checkout. */
import type { TierId } from "../products";
import type { Snapshot } from "./engine";

type Answers = Record<string, unknown>;
const s = (a: Answers, k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
const list = (a: Answers, k: string) => (Array.isArray(a[k]) ? (a[k] as Answers[]) : []);

export function buildSnapshotSource(
  tier: TierId,
  answers: Answers,
  extractedResume: string | null,
  sourceLabel: string,
): { snapshot: Snapshot; sourceText: string } {
  const base = {
    name: s(answers, "fullName"),
    email: s(answers, "email").toLowerCase(),
    phone: s(answers, "phone"),
    sourceLabel,
    ...(s(answers, "additionalInfo") ? { additionalInfo: s(answers, "additionalInfo") } : {}),
  };
  if (tier === "scratch") {
    const work = list(answers, "workHistory");
    const edu = list(answers, "education");
    const certs = s(answers, "certifications");
    const sourceText = [
      `Name: ${base.name}`,
      `Target job title (goal, not held): ${s(answers, "targetJobTitle")}`,
      s(answers, "careerField") ? `Career field: ${s(answers, "careerField")}` : "",
      "Work history:",
      ...work.map((w) => `- ${s(w, "title")} at ${s(w, "employer")} (${s(w, "dates")}): ${s(w, "details")}`),
      "Education:",
      ...edu.map((e) => `- ${s(e, "credential")}, ${s(e, "school")}${s(e, "dates") ? ` (${s(e, "dates")})` : ""}`),
      `Skills: ${s(answers, "skills")}`,
      certs ? `Certifications: ${certs}` : "",
      s(answers, "additionalExperience") ? `Additional experience: ${s(answers, "additionalExperience")}` : "",
      base.additionalInfo ? `Customer notes: ${base.additionalInfo}` : "",
    ].filter(Boolean).join("\n");
    return {
      sourceText,
      snapshot: {
        ...base,
        targetJobTitle: s(answers, "targetJobTitle"),
        requiredEmployers: work.map((w) => s(w, "employer")).filter(Boolean),
        requiredSchools: edu.map((e) => s(e, "school")).filter(Boolean),
        requiredCertifications: certs.split(/[\n;,]+/).map((c) => c.trim()).filter((c) => c.length > 1),
      },
    };
  }
  const sourceText = [extractedResume ?? "", base.additionalInfo ? `Customer notes: ${base.additionalInfo}` : ""]
    .filter(Boolean).join("\n\n");
  return {
    sourceText,
    snapshot: {
      ...base,
      ...(tier === "bundle"
        ? { targetJobTitle: s(answers, "targetJobTitle"), companyName: s(answers, "companyName"), specificJobTitle: s(answers, "specificJobTitle") }
        : {}),
      requiredEmployers: [],
      requiredSchools: [],
      requiredCertifications: [],
    },
  };
}
