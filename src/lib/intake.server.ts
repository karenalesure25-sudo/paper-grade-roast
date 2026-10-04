import { checkIntakeFile, schemaFor, type SubmitIntakePayload } from "./intake-schema";

const BUCKET = "intake-uploads";

function decode(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

export async function storeIntake(input: SubmitIntakePayload): Promise<{ id: string }> {
  const answers = schemaFor(input.tier).parse(input.answers) as Record<string, unknown>;

  if (input.tier !== "scratch" && !input.resume) throw new Error("Upload your current résumé.");
  if (input.tier === "scratch" && input.resume) throw new Error("This service doesn't take a résumé upload.");
  if (input.tier !== "bundle" && input.jobFile) throw new Error("This service doesn't take a job posting.");
  if (input.tier === "bundle" && !String(answers["jobDescription"] ?? "").trim() && !input.jobFile) {
    throw new Error("Paste the full job description or upload the job posting.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const folder = crypto.randomUUID();

  async function upload(kind: string, file: NonNullable<SubmitIntakePayload["resume"]>) {
    const bytes = decode(file.dataBase64);
    const problem = checkIntakeFile({ name: file.filename, size: bytes.byteLength, type: file.mimeType });
    if (problem) throw new Error(problem);
    const ext = file.filename.toLowerCase().split(".").pop();
    const path = `${folder}/${kind}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.mimeType || "application/octet-stream" });
    if (error) {
      console.error("intake upload failed", error.message);
      throw new Error("We couldn't save your file. Try again.");
    }
    return path;
  }

  const resumePath = input.resume ? await upload("resume", input.resume) : null;
  const jobPath = input.jobFile ? await upload("job-posting", input.jobFile) : null;

  const s = (k: string) => {
    const v = answers[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const { data, error } = await supabaseAdmin
    .from("intakes" as never)
    .insert({
      tier: input.tier,
      full_name: s("fullName"),
      email: s("email"),
      phone: s("phone"),
      target_job_title: s("targetJobTitle"),
      career_field: s("careerField"),
      company_name: s("companyName"),
      specific_job_title: s("specificJobTitle"),
      job_url: s("jobUrl"),
      job_description: s("jobDescription"),
      answers,
      resume_path: resumePath,
      resume_filename: input.resume?.filename ?? null,
      job_file_path: jobPath,
      job_file_filename: input.jobFile?.filename ?? null,
      confirmed: true,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    console.error("intake insert failed", error?.message);
    throw new Error("We couldn't save your order. Try again.");
  }
  return { id: (data as { id: string }).id };
}
