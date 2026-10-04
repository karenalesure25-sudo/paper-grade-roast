import { z } from "zod";
import type { TierId } from "./products";

export const INTAKE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const INTAKE_FILE_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALLOWED_EXT = [".pdf", ".doc", ".docx"];
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "",
];

/** Returns an error message, or null when the file is acceptable. */
export function checkIntakeFile(file: { name: string; size: number; type: string }): string | null {
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext)) || !ALLOWED_MIME.includes(file.type)) {
    return "Upload a PDF, DOC, or DOCX file.";
  }
  if (file.size === 0) return "That file is empty. Try another export.";
  if (file.size > INTAKE_MAX_FILE_BYTES) return "That file is over 10 MB. Try a smaller export.";
  return null;
}

const req = (label: string, max = 200) =>
  z.string().trim().min(1, { message: `${label} is required.` }).max(max, {
    message: `${label} must be under ${max} characters.`,
  });
const opt = (max = 2000) => z.string().trim().max(max, { message: `Keep this under ${max} characters.` });

export const WorkEntry = z.object({
  title: req("Job title", 120),
  employer: req("Employer", 120),
  dates: req("Dates", 60),
  details: req("Responsibilities and accomplishments", 3000),
});
export const EducationEntry = z.object({
  school: req("School", 160),
  credential: req("Degree or credential", 160),
  dates: opt(60),
});

const Contact = z.object({
  fullName: req("First and last name", 120).refine((v) => v.split(/\s+/).length >= 2, {
    message: "Enter your first and last name.",
  }),
  email: req("Email", 255).email({ message: "That email address doesn't look right." }),
  phone: req("Phone number", 30).refine((v) => v.replace(/\D/g, "").length >= 10, {
    message: "Enter a phone number with at least 10 digits.",
  }),
  additionalInfo: opt(3000),
});

export const RevampAnswers = Contact;

export const ScratchAnswers = Contact.extend({
  targetJobTitle: req("Target job title", 120),
  careerField: opt(120),
  workHistory: z.array(WorkEntry).min(1, { message: "Add at least one job." }).max(10),
  education: z.array(EducationEntry).min(1, { message: "Add your education." }).max(6),
  certifications: opt(2000),
  skills: req("Skills", 2000),
  additionalExperience: opt(3000),
});

export const BundleAnswers = Contact.extend({
  targetJobTitle: req("Target job title", 120),
  careerField: opt(120),
  companyName: req("Company name", 160),
  specificJobTitle: req("Specific job title", 160),
  jobUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/i.test(v), { message: "That job link doesn't look right." }),
  jobDescription: opt(24000),
});

export type IntakeAnswers = {
  fullName: string;
  email: string;
  phone: string;
  additionalInfo: string;
  targetJobTitle: string;
  careerField: string;
  companyName: string;
  specificJobTitle: string;
  jobUrl: string;
  jobDescription: string;
  workHistory: Array<z.infer<typeof WorkEntry>>;
  education: Array<z.infer<typeof EducationEntry>>;
  certifications: string;
  skills: string;
  additionalExperience: string;
};

export function emptyAnswers(): IntakeAnswers {
  return {
    fullName: "",
    email: "",
    phone: "",
    additionalInfo: "",
    targetJobTitle: "",
    careerField: "",
    companyName: "",
    specificJobTitle: "",
    jobUrl: "",
    jobDescription: "",
    workHistory: [{ title: "", employer: "", dates: "", details: "" }],
    education: [{ school: "", credential: "", dates: "" }],
    certifications: "",
    skills: "",
    additionalExperience: "",
  };
}

export function schemaFor(tier: TierId) {
  return tier === "scratch" ? ScratchAnswers : tier === "bundle" ? BundleAnswers : RevampAnswers;
}

/** Keep only the fields that belong to this tier. */
export function pickAnswers(tier: TierId, a: IntakeAnswers): Record<string, unknown> {
  const base = { fullName: a.fullName, email: a.email, phone: a.phone, additionalInfo: a.additionalInfo };
  if (tier === "scratch")
    return {
      ...base,
      targetJobTitle: a.targetJobTitle,
      careerField: a.careerField,
      workHistory: a.workHistory,
      education: a.education,
      certifications: a.certifications,
      skills: a.skills,
      additionalExperience: a.additionalExperience,
    };
  if (tier === "bundle")
    return {
      ...base,
      targetJobTitle: a.targetJobTitle,
      careerField: a.careerField,
      companyName: a.companyName,
      specificJobTitle: a.specificJobTitle,
      jobUrl: a.jobUrl,
      jobDescription: a.jobDescription,
    };
  return base;
}

/** Field-path -> message map, plus tier-specific file rules. */
export function validateIntake(
  tier: TierId,
  answers: IntakeAnswers,
  files: { resume: boolean; jobFile: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const result = schemaFor(tier).safeParse(pickAnswers(tier, answers));
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (!errors[key]) errors[key] = issue.message;
    }
  }
  if (tier !== "scratch" && !files.resume) errors["resume"] = "Upload your current résumé.";
  if (tier === "bundle" && !answers.jobDescription.trim() && !files.jobFile) {
    errors["jobDescription"] =
      "Paste the full job description or upload the job posting — one is required.";
  }
  return errors;
}

const FilePayload = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().max(120),
  dataBase64: z.string().max(Math.ceil((INTAKE_MAX_FILE_BYTES * 4) / 3) + 1024),
});

export const SubmitIntakeInput = z.object({
  tier: z.enum(["revamp", "scratch", "bundle"]),
  answers: z.record(z.string(), z.unknown()),
  confirmed: z.literal(true),
  resume: FilePayload.optional(),
  jobFile: FilePayload.optional(),
});
export type SubmitIntakePayload = z.infer<typeof SubmitIntakeInput>;
