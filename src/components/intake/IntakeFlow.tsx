import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { StampButton } from "@/components/StampButton";
import type { Tier } from "@/lib/products";
import {
  INTAKE_FILE_ACCEPT,
  checkIntakeFile,
  emptyAnswers,
  validateIntake,
  type IntakeAnswers,
} from "@/lib/intake-schema";
import { submitIntake } from "@/lib/intake.functions";

export type SubmittedIntake = {
  id: string;
  answers: IntakeAnswers;
  resume: File | null;
  jobFile: File | null;
};

const inputCls =
  "mt-2 min-h-12 w-full border border-border bg-paper-shade p-3 font-sans text-[16px] text-ivory outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold aria-[invalid=true]:border-redpen-text";
const labelCls = "block font-sans text-sm font-semibold text-ivory";
const fileCls =
  "mt-2 block min-h-12 w-full border border-border bg-paper-shade p-2 font-sans text-[0.95rem] text-muted-foreground file:mr-4 file:min-h-10 file:border file:border-gold/50 file:bg-card file:px-4 file:py-2 file:font-sans file:text-xs file:font-bold file:text-ivory file:uppercase";

const CONFIRM_TEXT =
  "I confirm that the information I provided is accurate and that I have provided all required information and documents for my selected service.";

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return window.btoa(binary);
}

async function filePayload(file: File) {
  return { filename: file.name, mimeType: file.type, dataBase64: toBase64(await file.arrayBuffer()) };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="premium-panel p-6 sm:p-8">
      <h2 className="font-brand text-2xl text-ivory sm:text-3xl">{title}</h2>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function FieldError({ id, msg }: { id: string; msg?: string | undefined }) {
  if (!msg) return null;
  return (
    <p id={`${id}-error`} className="mt-2 font-sans text-[0.9rem] text-redpen-text">
      {msg}
    </p>
  );
}

export function IntakeFlow({
  tier,
  onSubmitted,
}: {
  tier: Tier;
  onSubmitted: (intake: SubmittedIntake) => void;
}) {
  const submit = useServerFn(submitIntake);
  const [a, setA] = useState<IntakeAnswers>(emptyAnswers);
  const [resume, setResume] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "review">("form");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef<HTMLInputElement>(null);

  const isScratch = tier.id === "scratch";
  const isBundle = tier.id === "bundle";

  const set = <K extends keyof IntakeAnswers>(key: K, value: IntakeAnswers[K]) =>
    setA((prev) => ({ ...prev, [key]: value }));

  function text(
    key: keyof IntakeAnswers,
    label: string,
    opts: { required?: boolean; type?: string; area?: number; placeholder?: string; auto?: string } = {},
  ) {
    const id = `f-${key}`;
    const err = errors[key];
    const common = {
      id,
      name: key,
      value: a[key] as string,
      placeholder: opts.placeholder,
      "aria-invalid": Boolean(err),
      "aria-describedby": err ? `${id}-error` : undefined,
      className: inputCls,
    };
    return (
      <div>
        <label htmlFor={id} className={labelCls}>
          {label} {opts.required ? <span className="text-redpen-text">*</span> : <span className="normal-case tracking-normal text-muted-foreground">(optional)</span>}
        </label>
        {opts.area ? (
          <textarea {...common} rows={opts.area} onChange={(e) => set(key, e.target.value as never)} />
        ) : (
          <input
            {...common}
            type={opts.type ?? "text"}
            autoComplete={opts.auto}
            onChange={(e) => set(key, e.target.value as never)}
          />
        )}
        <FieldError id={id} msg={err} />
      </div>
    );
  }

  function fileField(kind: "resume" | "jobFile", label: string, required: boolean) {
    const id = `f-${kind}`;
    const current = kind === "resume" ? resume : jobFile;
    const err = errors[kind];
    return (
      <div>
        <label htmlFor={id} className={labelCls}>
          {label} {required ? <span className="text-redpen-text">*</span> : <span className="normal-case tracking-normal text-muted-foreground">(optional)</span>}
        </label>
        <input
          ref={kind === "resume" ? resumeRef : jobRef}
          id={id}
          name={kind}
          type="file"
          accept={INTAKE_FILE_ACCEPT}
          aria-invalid={Boolean(err)}
          aria-describedby={err ? `${id}-error` : undefined}
          className={fileCls}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            const problem = f ? checkIntakeFile(f) : null;
            setErrors((prev) => {
              const next = { ...prev };
              if (problem) next[kind] = problem;
              else delete next[kind];
              return next;
            });
            if (problem) e.target.value = "";
            if (kind === "resume") setResume(problem ? null : f);
            else setJobFile(problem ? null : f);
          }}
        />
        <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
          {current ? `Attached: ${current.name}` : "PDF or DOCX · up to 5 MB"}
        </p>
        <FieldError id={id} msg={err} />
      </div>
    );
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    // DOM fallback: some browsers attach files without firing React's change event.
    const r = resume ?? resumeRef.current?.files?.[0] ?? null;
    const j = jobFile ?? jobRef.current?.files?.[0] ?? null;
    const next = validateIntake(tier.id, a, { resume: Boolean(r), jobFile: Boolean(j) });
    for (const [k, f] of [["resume", r], ["jobFile", j]] as const) {
      const problem = f ? checkIntakeFile(f) : null;
      if (problem) next[k] = problem;
    }
    if (!confirmed) next["confirm"] = "Check the confirmation box to continue.";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0]!;
      const el =
        document.getElementById(`f-${first}`) ??
        document.getElementById(`f-${first.replace(/\.(\d+)\./, "-$1-")}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null)?.focus?.();
      return;
    }
    setResume(r);
    setJobFile(j);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finalSubmit() {
    if (pending) return;
    setPending(true);
    setSubmitError(null);
    try {
      const { pickAnswers } = await import("@/lib/intake-schema");
      const result = await submit({
        data: {
          tier: tier.id,
          answers: pickAnswers(tier.id, a),
          confirmed: true,
          ...(!isScratch && resume ? { resume: await filePayload(resume) } : {}),
          ...(isBundle && jobFile ? { jobFile: await filePayload(jobFile) } : {}),
        },
      });
      onSubmitted({ id: result.id, answers: a, resume: isScratch ? null : resume, jobFile: isBundle ? jobFile : null });
    } catch (cause) {
      console.error("intake submit failed");
      setSubmitError(
        cause instanceof Error && cause.message ? cause.message : "We couldn't submit your order. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (step === "review") {
    const rows: Array<[string, string]> = [
      ["Service", `${tier.name} — $${tier.price}`],
      ["Name", a.fullName],
      ["Email", a.email],
      ["Phone", a.phone],
    ];
    if (!isScratch) rows.push(["Current résumé", resume?.name ?? ""]);
    if (isScratch || isBundle) {
      rows.push(["Target job title", a.targetJobTitle], ["Target career field", a.careerField]);
    }
    if (isScratch) {
      rows.push(
        [
          "Work history",
          a.workHistory
            .map((w) => `${w.title} — ${w.employer} (${w.dates})\n${w.details}`)
            .join("\n\n"),
        ],
        [
          "Education",
          a.education.map((e) => `${e.credential} — ${e.school}${e.dates ? ` (${e.dates})` : ""}`).join("\n"),
        ],
        ["Skills", a.skills],
        ["Certifications", a.certifications],
        ["Additional professional experience", a.additionalExperience],
      );
    }
    if (isBundle) {
      rows.push(
        ["Company name", a.companyName],
        ["Specific job title", a.specificJobTitle],
        ["Job posting URL", a.jobUrl],
        ["Full job description", a.jobDescription],
        ["Job posting upload", jobFile?.name ?? ""],
      );
    }
    rows.push(["Additional information", a.additionalInfo]);

    return (
      <div className="mt-12 space-y-8">
        <Card title="Review your order">
          <p className="font-sans text-[0.95rem] text-muted-foreground">
            Check everything below. Go back to edit anything before you submit.
          </p>
          <dl className="divide-y divide-border">
            {rows.map(([k, v]) => (
              <div key={k} className="py-4">
                <dt className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">{k}</dt>
                <dd className="mt-2 max-h-64 overflow-y-auto font-sans text-[0.95rem] break-words whitespace-pre-wrap text-ink">
                  {v.trim() ? v : <span className="text-muted-foreground">Not provided</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={pending}
            onClick={() => setStep("form")}
            className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft decoration-2 underline-offset-4"
          >
            Edit answers
          </button>
          <StampButton type="button" onClick={finalSubmit} disabled={pending}>
            {pending ? "Submitting..." : "SUBMIT ORDER"}
          </StampButton>
        </div>
        <div aria-live="polite">
          {submitError && <p className="font-sans text-[0.95rem] text-redpen-text">{submitError}</p>}
        </div>
      </div>
    );
  }

  const errCount = Object.keys(errors).length;

  return (
    <form onSubmit={review} noValidate className="mt-12 space-y-8">
      {isBundle && (
        <p className="border-l-4 border-redpen bg-card p-5 font-sans text-[1rem] font-semibold text-ink">
          This package includes tailoring your resume to ONE specific job posting.
        </p>
      )}

      <Card title="Your contact details">
        {text("fullName", "First and last name", { required: true, auto: "name" })}
        {text("email", "Email address", { required: true, type: "email", auto: "email" })}
        {text("phone", "Phone number", { required: true, type: "tel", auto: "tel" })}
      </Card>

      {!isScratch && <Card title="Your current résumé">{fileField("resume", "Current résumé upload", true)}</Card>}

      {(isScratch || isBundle) && (
        <Card title="Your target role">
          {text("targetJobTitle", "Target job title", { required: true })}
          {text("careerField", "Target career field")}
        </Card>
      )}

      {isScratch && (
        <>
          <Card title="Work history">
            {a.workHistory.map((w, i) => (
              <fieldset key={i} className="space-y-4 border border-border p-4">
                <legend className="px-2 font-typewriter text-xs tracking-widest text-muted-foreground uppercase">
                  Job {i + 1}
                </legend>
                {(
                  [
                    ["title", "Job title", false],
                    ["employer", "Employer", false],
                    ["dates", "Dates (e.g. 2021 – present)", false],
                    ["details", "Responsibilities and accomplishments", true],
                  ] as const
                ).map(([k, label, area]) => {
                  const id = `f-workHistory-${i}-${k}`;
                  const err = errors[`workHistory.${i}.${k}`];
                  const props = {
                    id,
                    value: w[k],
                    "aria-invalid": Boolean(err),
                    className: inputCls,
                    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      set(
                        "workHistory",
                        a.workHistory.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                      ),
                  };
                  return (
                    <div key={k}>
                      <label htmlFor={id} className={labelCls}>
                        {label} <span className="text-redpen-text">*</span>
                      </label>
                      {area ? <textarea {...props} rows={5} /> : <input {...props} type="text" />}
                      <FieldError id={id} msg={err} />
                    </div>
                  );
                })}
                {a.workHistory.length > 1 && (
                  <button
                    type="button"
                    onClick={() => set("workHistory", a.workHistory.filter((_, j) => j !== i))}
                    className="font-sans text-[0.9rem] text-muted-foreground underline"
                  >
                    Remove this job
                  </button>
                )}
              </fieldset>
            ))}
            <FieldError id="f-workHistory" msg={errors["workHistory"]} />
            {a.workHistory.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  set("workHistory", [...a.workHistory, { title: "", employer: "", dates: "", details: "" }])
                }
                className="border border-ink px-4 py-3 font-stamp text-xs tracking-widest text-ink uppercase"
              >
                + Add another job
              </button>
            )}
          </Card>

          <Card title="Education">
            {a.education.map((ed, i) => (
              <fieldset key={i} className="space-y-4 border border-border p-4">
                <legend className="px-2 font-typewriter text-xs tracking-widest text-muted-foreground uppercase">
                  Education {i + 1}
                </legend>
                {(
                  [
                    ["school", "School", true],
                    ["credential", "Degree, diploma, or credential", true],
                    ["dates", "Dates", false],
                  ] as const
                ).map(([k, label, required]) => {
                  const id = `f-education-${i}-${k}`;
                  const err = errors[`education.${i}.${k}`];
                  return (
                    <div key={k}>
                      <label htmlFor={id} className={labelCls}>
                        {label}{" "}
                        {required ? (
                          <span className="text-redpen-text">*</span>
                        ) : (
                          <span className="normal-case tracking-normal text-muted-foreground">(optional)</span>
                        )}
                      </label>
                      <input
                        id={id}
                        type="text"
                        value={ed[k]}
                        aria-invalid={Boolean(err)}
                        className={inputCls}
                        onChange={(e) =>
                          set(
                            "education",
                            a.education.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                          )
                        }
                      />
                      <FieldError id={id} msg={err} />
                    </div>
                  );
                })}
                {a.education.length > 1 && (
                  <button
                    type="button"
                    onClick={() => set("education", a.education.filter((_, j) => j !== i))}
                    className="font-sans text-[0.9rem] text-muted-foreground underline"
                  >
                    Remove
                  </button>
                )}
              </fieldset>
            ))}
            {a.education.length < 6 && (
              <button
                type="button"
                onClick={() => set("education", [...a.education, { school: "", credential: "", dates: "" }])}
                className="border border-ink px-4 py-3 font-stamp text-xs tracking-widest text-ink uppercase"
              >
                + Add education
              </button>
            )}
          </Card>

          <Card title="Skills & extras">
            {text("skills", "Skills", { required: true, area: 4, placeholder: "e.g. Customer service, Excel, scheduling, bilingual (Spanish)" })}
            {text("certifications", "Certifications", { area: 3 })}
            {text("additionalExperience", "Additional professional experience", { area: 4, placeholder: "Volunteer work, freelance, military, leadership roles..." })}
          </Card>
        </>
      )}

      {isBundle && (
        <Card title="The ONE job you're targeting">
          {text("companyName", "Company name", { required: true })}
          {text("specificJobTitle", "Specific job title", { required: true })}
          {text("jobUrl", "Job posting URL", { type: "url", placeholder: "https://..." })}
          {text("jobDescription", "Full job description", { area: 8, placeholder: "Paste the full posting here." })}
          {fileField("jobFile", "Job posting upload", false)}
          <p className="font-sans text-[0.9rem] text-muted-foreground">
            <span className="text-redpen-text">*</span> You must paste the full job description <strong>or</strong> upload the job posting.
          </p>
        </Card>
      )}

      <Card title="Anything else?">{text("additionalInfo", "Additional information / instructions", { area: 4 })}</Card>

      <div className="border border-border bg-card p-6 shadow-paper sm:p-8">
        <label htmlFor="f-confirm" className="flex cursor-pointer items-start gap-3">
          <input
            id="f-confirm"
            type="checkbox"
            checked={confirmed}
            aria-invalid={Boolean(errors["confirm"])}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              if (e.target.checked)
                setErrors((p) => {
                  const n = { ...p };
                  delete n["confirm"];
                  return n;
                });
            }}
            className="mt-1 size-5 shrink-0 accent-redpen"
          />
          <span className="font-sans text-[0.95rem] leading-relaxed text-ink">{CONFIRM_TEXT}</span>
        </label>
        <FieldError id="f-confirm" msg={errors["confirm"]} />
        <div className="mt-6">
          <StampButton type="submit">REVIEW ORDER</StampButton>
        </div>
        <div aria-live="polite">
          {errCount > 0 && (
            <p className="mt-4 font-sans text-[0.95rem] text-redpen-text">
              Please fix the {errCount === 1 ? "highlighted field" : `${errCount} highlighted fields`} above.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
