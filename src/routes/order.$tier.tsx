import { useState } from "react";
import { BrandLink } from "@/components/BrandMark";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { StampButton } from "@/components/StampButton";
import { SiteFooter } from "@/components/SiteFooter";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PhotoCropper } from "@/components/PhotoCropper";
import { ResumeDeliverable } from "@/components/ResumeDeliverable";
import { AtsReportCard } from "@/components/AtsReportCard";
import { getTier, TIERS } from "@/lib/products";
import { prepareUpload } from "@/lib/prepare-upload";
import { buildResume } from "@/lib/order.functions";
import { saveOrder, type StoredOrder } from "@/lib/order-session";
import {
  COVER_LETTER_STYLES,
  renderCoverLetterHtml,
  type CoverLetterStyle,
} from "@/lib/cover-letter-doc";
import {
  PHOTO_LAYOUT_COUNT,
  RESUME_TEMPLATES,
  type TemplateId,
} from "@/lib/resume-templates";

export const Route = createFileRoute("/order/$tier")({
  beforeLoad: ({ params }) => {
    if (!getTier(params.tier)) throw notFound();
  },
  head: ({ params }) => {
    const tier = getTier(params.tier);
    const title = tier ? `${tier.name} — Kay’s Career Solutions` : "Order — Kay’s Career Solutions";
    const description = tier
      ? `${tier.tagline} $${tier.price}, one-time.`
      : "Pick your Kay’s Career Solutions résumé package.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: OrderPage,
});

function SectionLabel({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-stamp text-sm text-ink-soft">{String(step).padStart(2, "0")}</span>
      <h2 className="font-stamp text-xl text-ink sm:text-2xl">{children}</h2>
    </div>
  );
}

function OrderPage() {
  const { tier: tierId } = Route.useParams();
  const tier = getTier(tierId)!;
  const run = useServerFn(buildResume);

  const [file, setFile] = useState<File | null>(null);
  const [background, setBackground] = useState("");
  const [email, setEmail] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>("sidebar");
  const [letterStyle, setLetterStyle] = useState<CoverLetterStyle>("ivory");
  /** intake -> (job review, $60 only) -> checkout -> layout (+photo) -> delivered résumé */
  const [phase, setPhase] = useState<"intake" | "confirm" | "layout" | "done">(
    "intake",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<StoredOrder | null>(null);

  const needsResume = tier.intake === "resume" || tier.intake === "resume+job";
  const templateUsesPhoto =
    RESUME_TEMPLATES.find((t) => t.id === template)?.usesPhoto ?? false;
  const jobStep = tier.intake === "resume+job";
  /** $60 adds a job-posting review step before the charge is finalized. */
  const reviewStep = jobStep ? 3 : 0;
  const checkoutStep = jobStep ? 4 : 2;
  const layoutStep = checkoutStep + 1;

  /** Placeholder checkout. Payment first, then layout + photo, then the AI run. */
  function pay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (needsResume && !file) {
      setError("Upload your résumé as a PDF or DOCX first.");
      return;
    }
    if (tier.intake === "background" && !file && background.trim().length < 40) {
      setError("Tell us a bit more about your background, or upload your notes.");
      return;
    }
    if (jobStep && !jobUrl.trim() && jobText.trim().length < 40 && !jobFile) {
      setError(
        "Add the job you want this tailored to — paste the link, paste the posting, or upload it.",
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Add the email address we should send your order confirmation to.");
      return;
    }

    setError(null);
    setPhase(jobStep ? "confirm" : "layout");
  }


  async function build() {
    if (pending) return;
    if (templateUsesPhoto && !photo) {
      setError("Upload a photo and confirm its placement for this layout.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      type Payload = {
        tier: typeof tier.id;
        email: string;
        template: TemplateId;
        text?: string;
        file?: { filename: string; mimeType: "application/pdf"; dataBase64: string };
        jobUrl?: string;
        jobText?: string;
        jobFile?: { filename: string; mimeType: "application/pdf"; dataBase64: string };
      };
      let payload: Payload = { tier: tier.id, email: email.trim(), template };


      if (file) {
        const prepared = await prepareUpload(file);
        payload =
          prepared.kind === "pdf"
            ? {
                ...payload,
                file: {
                  filename: prepared.filename,
                  mimeType: prepared.mimeType,
                  dataBase64: prepared.dataBase64,
                },
              }
            : { ...payload, text: prepared.text };
      } else {
        payload = { ...payload, text: background.trim() };
      }

      if (jobStep) {
        let extraJobText = jobText.trim();
        let preparedJobFile: Payload["jobFile"];

        if (jobFile) {
          const preparedJob = await prepareUpload(jobFile);
          if (preparedJob.kind === "pdf") {
            preparedJobFile = {
              filename: preparedJob.filename,
              mimeType: preparedJob.mimeType,
              dataBase64: preparedJob.dataBase64,
            };
          } else {
            extraJobText = [extraJobText, preparedJob.text].filter(Boolean).join("\n\n");
          }
        }

        payload = {
          ...payload,
          ...(jobUrl.trim() ? { jobUrl: jobUrl.trim() } : {}),
          ...(extraJobText ? { jobText: extraJobText } : {}),
          ...(preparedJobFile ? { jobFile: preparedJobFile } : {}),
        };
      }

      const result = await run({ data: payload });
      setOrder(saveOrder({ tier: tier.id, template, paid: true, result }));
      setPhase("done");
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Something went wrong writing your résumé. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  /** Bundle tier: hand the buyer their cover letter as a styled, printable page. */
  function downloadCoverLetter() {
    const letter = order?.result.coverLetter;
    if (!letter) return;

    // Prefer the server-signed link: mobile browsers handle a real HTTP
    // attachment reliably, blob downloads often silently no-op there.
    if (order?.result.coverLetterUrl) {
      window.location.href = `${order.result.coverLetterUrl}?style=${letterStyle}`;
      return;
    }

    const resume = order?.result.resume;
    const html = renderCoverLetterHtml(letter, letterStyle, {
      name: resume?.name,
      title: resume?.title,
      email: resume?.email,
      phone: resume?.phone,
      location: resume?.location,
      ...(order?.result.jobLabel ? { jobLabel: order.result.jobLabel } : {}),
    });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener";
    link.download = `${(resume?.name || "kcs").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "kcs"}-cover-letter.html`;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 2000);
  }


  return (
    <div className="paper-texture relative min-h-screen">
      <header className="px-5 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <BrandLink size="sm" withTagline={false} />
          <Link
            to="/"
            className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft decoration-2 underline-offset-4 transition-colors hover:text-ink"
          >
            Back to the front page
          </Link>
        </div>
      </header>

      <main className="px-5 pb-20">
        <div className="mx-auto max-w-5xl">
          <p className="font-typewriter text-xs tracking-[0.3em] text-ink-soft uppercase">
            ${tier.price} &middot; {tier.name}
          </p>
          <h1 className="mt-4 font-stamp text-[2.1rem] leading-[1.1] text-ink sm:text-5xl">
            {tier.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {tier.tagline}
          </p>

          {phase === "intake" && (
            <nav className="mt-6 flex flex-wrap gap-3">
              {TIERS.filter((other) => other.id !== tier.id).map((other) => (
                <Link
                  key={other.id}
                  to="/order/$tier"
                  params={{ tier: other.id }}
                  className="font-sans text-[0.85rem] text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
                >
                  Switch to {other.name} (${other.price})
                </Link>
              ))}
            </nav>
          )}

          {phase === "done" && order ? (
            <section className="mt-14 space-y-8">
              <div>
                <SectionLabel step={layoutStep + 1}>Your résumé is ready</SectionLabel>
                <p className="mt-3 font-sans text-[0.95rem] text-muted-foreground">
                  Built from {order.result.sourceLabel} &middot;{" "}
                  {RESUME_TEMPLATES.find((t) => t.id === order.template)?.name}
                </p>
              </div>

              <ResumeDeliverable order={order} photo={photo} />

              <div className="border border-border bg-card p-6 shadow-paper">
                <p className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                  Order confirmation
                </p>
                <p className="mt-3 font-sans text-[0.95rem] leading-relaxed text-ink">
                  {order.result.emailed && order.result.email ? (
                    <>
                      Sent to <span className="marker">{order.result.email}</span> with
                      your download links.
                    </>
                  ) : (
                    <>
                      Email delivery isn&rsquo;t switched on yet, so grab your files
                      right here &mdash; the links below are yours for 7 days.
                    </>
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-5">
                  {order.result.resumeUrl && (
                    <a
                      href={order.result.resumeUrl}
                      className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft decoration-2 underline-offset-4 transition-colors hover:text-ink"
                    >
                      Download my résumé
                    </a>
                  )}
                  {order.result.coverLetterUrl && (
                    <a
                      href={`${order.result.coverLetterUrl}?style=${letterStyle}`}
                      className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft decoration-2 underline-offset-4 transition-colors hover:text-ink"
                    >
                      Download my cover letter
                    </a>
                  )}
                </div>
                {order.result.downloadsExpireAt && (
                  <p className="mt-4 font-sans text-[0.85rem] text-muted-foreground">
                    These links work until{" "}
                    {new Date(order.result.downloadsExpireAt).toLocaleDateString()} — 7
                    days — then your files are deleted for good.
                  </p>
                )}
              </div>


              {order.tier === "bundle" && order.result.atsReport && (
                <AtsReportCard
                  report={order.result.atsReport}
                  jobLabel={order.result.jobUrl ?? order.result.jobLabel}
                />
              )}

              {order.tier === "bundle" && (
                <div className="border border-border bg-card p-6 shadow-paper">
                  <SectionLabel step={layoutStep + 2}>Your cover letter</SectionLabel>
                  <p className="mt-3 font-sans text-[0.95rem] leading-relaxed text-ink">
                    ATS-optimized and tailored to{" "}
                    <span className="marker break-all">
                      {order.result.jobUrl ?? order.result.jobLabel}
                    </span>
                  </p>
                  {order.result.coverLetter ? (
                    <>
                      <div className="mt-5 max-h-[26rem] overflow-y-auto border border-border bg-paper-shade p-5">
                        <p className="font-sans text-[0.95rem] leading-relaxed whitespace-pre-wrap text-ink">
                          {order.result.coverLetter}
                        </p>
                      </div>
                      <div className="mt-6">
                        <p className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                          Pick a letterhead
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {COVER_LETTER_STYLES.map((option) => {
                            const active = option.id === letterStyle;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setLetterStyle(option.id)}
                                aria-pressed={active}
                                className={`border p-4 text-left transition-colors ${
                                  active
                                    ? "border-redpen bg-paper-shade"
                                    : "border-border bg-card hover:border-ink-soft"
                                }`}
                              >
                                <span className="flex gap-1.5">
                                  {option.swatch.map((color) => (
                                    <span
                                      key={color}
                                      className="h-4 w-4 rounded-full border border-border"
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </span>
                                <span className="mt-3 block font-sans text-[0.95rem] font-semibold text-ink">
                                  {option.name}
                                </span>
                                <span className="mt-1 block font-sans text-[0.8rem] leading-snug text-muted-foreground">
                                  {option.blurb}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <StampButton
                        type="button"
                        onClick={downloadCoverLetter}
                        className="mt-6"
                      >
                        Download Cover Letter
                      </StampButton>
                    </>
                  ) : (
                    <p className="mt-5 font-hand text-2xl leading-tight text-redpen">
                      The cover letter didn&rsquo;t come through. Run it again and it
                      will.
                    </p>
                  )}
                </div>
              )}
            </section>
          ) : phase === "confirm" ? (
            <section className="mt-12 space-y-8">
              <div>
                <SectionLabel step={reviewStep}>Confirm the job posting</SectionLabel>
                <p className="mt-3 max-w-2xl font-sans text-[0.95rem] text-muted-foreground">
                  Read this back before we charge you &mdash; the tailoring and the
                  cover letter are written from exactly what&rsquo;s here.
                </p>
              </div>

              <div className="border border-border bg-card p-6 shadow-paper sm:p-8">
                <dl className="space-y-6">
                  <div>
                    <dt className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                      Your résumé
                    </dt>
                    <dd className="mt-2 font-sans text-[0.95rem] break-all text-ink">
                      {file ? file.name : "Written from your notes"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                      Confirmation email
                    </dt>
                    <dd className="mt-2 font-sans text-[0.95rem] break-all text-ink">
                      <span className="marker">{email.trim()}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                      Job link
                    </dt>
                    <dd className="mt-2 font-sans text-[0.95rem] break-all text-ink">
                      {jobUrl.trim() ? (
                        <span className="marker">{jobUrl.trim()}</span>
                      ) : (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                      Posting text
                    </dt>
                    <dd className="mt-2 max-h-64 overflow-y-auto border border-border bg-paper-shade p-4 font-sans text-[0.95rem] leading-relaxed whitespace-pre-wrap text-ink">
                      {jobText.trim() || (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                      Uploaded posting
                    </dt>
                    <dd className="mt-2 font-sans text-[0.95rem] break-all text-ink">
                      {jobFile ? (
                        jobFile.name
                      ) : (
                        <span className="text-muted-foreground">No file attached</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="border border-border bg-card p-6 shadow-paper sm:p-8">
                <SectionLabel step={checkoutStep}>Checkout</SectionLabel>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <p className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                      {tier.name}
                    </p>
                    <p className="mt-2 font-stamp text-4xl text-ink">${tier.price}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-5">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setPhase("intake");
                      }}
                      className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft decoration-2 underline-offset-4 transition-colors hover:text-ink"
                    >
                      Edit the job details
                    </button>
                    <StampButton
                      type="button"
                      onClick={() => {
                        setError(null);
                        setPhase("layout");
                      }}
                    >
                      {`Confirm & Pay $${tier.price}`}
                    </StampButton>
                  </div>
                </div>
                <p className="mt-5 border-t border-dashed border-border pt-4 font-sans text-[0.85rem] leading-relaxed text-muted-foreground">
                  Placeholder checkout &mdash; no card is charged yet. Next you pick your
                  layout, add a photo if it needs one, and then we write the tailored
                  résumé plus the cover letter.
                </p>
              </div>
            </section>
          ) : phase === "layout" ? (
            <section className="mt-12 space-y-8">
              <div>
                <SectionLabel step={layoutStep}>Pick your layout</SectionLabel>
                <p className="mt-3 max-w-2xl font-sans text-[0.95rem] text-muted-foreground">
                  Payment received &mdash; all {RESUME_TEMPLATES.length} layouts are
                  unlocked. {PHOTO_LAYOUT_COUNT} use a photo; the rest are text only.
                </p>
              </div>

              <TemplatePicker value={template} onChange={setTemplate} unlocked={true} />

              {templateUsesPhoto ? (
                <div>
                  <SectionLabel step={layoutStep + 1}>Your photo</SectionLabel>
                  <div className="mt-5">
                    <PhotoCropper
                      round={template === "sidebar"}
                      value={photo}
                      onConfirm={setPhoto}
                    />
                  </div>
                </div>
              ) : (
                <p className="font-hand text-2xl leading-tight text-redpen">
                  Plain sheet &mdash; no photo needed. Straight to the writing.
                </p>
              )}

              <div className="border border-border bg-card p-6 shadow-paper sm:p-8">
                <StampButton type="button" onClick={build} disabled={pending}>
                  {pending ? "Writing..." : "Build My Résumé"}
                </StampButton>
                <p className="mt-5 font-sans text-[0.85rem] leading-relaxed text-muted-foreground">
                  {templateUsesPhoto
                    ? "Your layout and photo are locked in before the writing starts."
                    : "Your layout is locked in before the writing starts."}
                </p>
                {error && (
                  <p className="mt-5 font-hand text-2xl leading-tight text-redpen">
                    {error}
                  </p>
                )}
              </div>
            </section>
          ) : (
            <form onSubmit={pay} className="mt-12 space-y-12">
              <section>
                <SectionLabel step={1}>
                  {tier.intake === "background"
                    ? "Your background"
                    : "Upload your résumé"}
                </SectionLabel>

                <div className="mt-5 border border-border bg-card p-6 shadow-paper sm:p-8">
                  {tier.intake === "background" ? (
                    <>
                      <label
                        htmlFor="background"
                        className="font-typewriter text-sm tracking-widest text-ink uppercase"
                      >
                        Jobs, dates, duties, wins &mdash; however messy
                      </label>
                      <textarea
                        id="background"
                        name="background"
                        rows={8}
                        value={background}
                        onChange={(event) => setBackground(event.target.value)}
                        placeholder="Fresenius Medical Care, patient care tech, 2024 to now. Verify patient ID, record vitals, HIPAA..."
                        className="mt-3 w-full border border-border bg-paper-shade p-3 font-sans text-[0.95rem] text-ink outline-none focus:border-redpen"
                      />
                      <p className="mt-4 font-sans text-[0.85rem] text-muted-foreground">
                        Or upload your notes as a PDF or DOCX instead:
                      </p>
                    </>
                  ) : (
                    <label
                      htmlFor="resumeFile"
                      className="font-typewriter text-sm tracking-widest text-ink uppercase"
                    >
                      Your current résumé (PDF or DOCX)
                    </label>
                  )}

                  <input
                    id="resumeFile"
                    name="resumeFile"
                    type="file"
                    accept=".pdf,.docx,application/pdf"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="mt-2 block w-full font-sans text-[0.95rem] text-muted-foreground file:mr-4 file:border file:border-ink file:bg-transparent file:px-4 file:py-2 file:font-stamp file:text-xs file:tracking-widest file:text-ink file:uppercase hover:file:border-ink-soft hover:file:text-ink"
                  />
                  <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
                    {file ? `Attached: ${file.name}` : "PDF or DOCX \u00b7 up to 5MB"}
                  </p>

                  <label
                    htmlFor="email"
                    className="mt-8 block font-typewriter text-sm tracking-widest text-ink uppercase"
                  >
                    Where should we send it?
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-3 w-full border border-border bg-paper-shade p-3 font-sans text-[0.95rem] text-ink outline-none focus:border-redpen"
                  />
                  <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
                    Your order confirmation and download links go here. Links expire
                    after 7 days.
                  </p>
                </div>
              </section>


              {jobStep && (
                <section>
                  <SectionLabel step={2}>The job you want</SectionLabel>
                  <div className="mt-5 border border-border bg-card p-6 shadow-paper sm:p-8">
                    <label
                      htmlFor="jobUrl"
                      className="font-typewriter text-sm tracking-widest text-ink uppercase"
                    >
                      Job posting link
                    </label>
                    <input
                      id="jobUrl"
                      name="jobUrl"
                      type="url"
                      value={jobUrl}
                      onChange={(event) => setJobUrl(event.target.value)}
                      placeholder="https://boards.example.com/jobs/1234"
                      className="mt-3 w-full border border-border bg-paper-shade p-3 font-sans text-[0.95rem] text-ink outline-none focus:border-redpen"
                    />
                    <label
                      htmlFor="jobText"
                      className="mt-6 block font-typewriter text-sm tracking-widest text-ink uppercase"
                    >
                      Or paste the posting / role description
                    </label>
                    <textarea
                      id="jobText"
                      name="jobText"
                      rows={5}
                      value={jobText}
                      onChange={(event) => setJobText(event.target.value)}
                      placeholder="Title, company, responsibilities, required skills..."
                      className="mt-3 w-full border border-border bg-paper-shade p-3 font-sans text-[0.95rem] text-ink outline-none focus:border-redpen"
                    />
                    <label
                      htmlFor="jobFile"
                      className="mt-6 block font-typewriter text-sm tracking-widest text-ink uppercase"
                    >
                      Or upload the posting (PDF or DOCX)
                    </label>
                    <input
                      id="jobFile"
                      name="jobFile"
                      type="file"
                      accept=".pdf,.docx,application/pdf"
                      onChange={(event) => setJobFile(event.target.files?.[0] ?? null)}
                      className="mt-2 block w-full font-sans text-[0.95rem] text-muted-foreground file:mr-4 file:border file:border-ink file:bg-transparent file:px-4 file:py-2 file:font-stamp file:text-xs file:tracking-widest file:text-ink file:uppercase hover:file:border-ink-soft hover:file:text-ink"
                    />
                    <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
                      {jobFile
                        ? `Attached: ${jobFile.name}`
                        : "A link, pasted text, or a file \u2014 any one is enough."}
                    </p>
                  </div>
                </section>
              )}

              <section>
                <SectionLabel step={jobStep ? reviewStep : checkoutStep}>
                  {jobStep ? "Review the job posting" : "Checkout"}
                </SectionLabel>
                <div className="mt-5 border border-border bg-card p-6 shadow-paper sm:p-8">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <p className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                        {tier.name}
                      </p>
                      <p className="mt-2 font-stamp text-4xl text-ink">${tier.price}</p>
                    </div>
                    <StampButton type="submit">
                      {jobStep ? "Review Job Details" : `Pay $${tier.price}`}
                    </StampButton>
                  </div>
                  <p className="mt-5 border-t border-dashed border-border pt-4 font-sans text-[0.85rem] leading-relaxed text-muted-foreground">
                    {jobStep
                      ? "Nothing is charged yet \u2014 you confirm the job posting on the next screen before checkout finalizes."
                      : "Placeholder checkout \u2014 no card is charged yet. Next you pick your layout, add a photo if it needs one, and then we write it."}
                  </p>
                  {error && (
                    <p className="mt-5 font-hand text-2xl leading-tight text-redpen">
                      {error}
                    </p>
                  )}
                </div>
              </section>
            </form>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
