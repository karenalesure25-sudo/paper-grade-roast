import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { StampButton } from "@/components/StampButton";
import { SiteFooter } from "@/components/SiteFooter";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PhotoCropper } from "@/components/PhotoCropper";
import { ResumeDeliverable } from "@/components/ResumeDeliverable";
import { getTier, TIERS } from "@/lib/products";
import { prepareUpload } from "@/lib/prepare-upload";
import { buildResume } from "@/lib/order.functions";
import { saveOrder, updateOrder, type StoredOrder } from "@/lib/order-session";
import { RESUME_TEMPLATES, type TemplateId } from "@/lib/resume-templates";

export const Route = createFileRoute("/order/$tier")({
  beforeLoad: ({ params }) => {
    if (!getTier(params.tier)) throw notFound();
  },
  head: ({ params }) => {
    const tier = getTier(params.tier);
    const title = tier ? `${tier.name} — Callback` : "Order — Callback";
    const description = tier
      ? `${tier.tagline} $${tier.price}, one-time.`
      : "Pick your Callback résumé package.";
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
      <span className="font-stamp text-sm text-redpen">{String(step).padStart(2, "0")}</span>
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
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>("sidebar");
  /** intake+checkout -> layout (+photo) -> delivered résumé */
  const [phase, setPhase] = useState<"intake" | "layout" | "done">("intake");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<StoredOrder | null>(null);

  const needsResume = tier.intake === "resume" || tier.intake === "resume+job";
  const templateUsesPhoto =
    RESUME_TEMPLATES.find((t) => t.id === template)?.usesPhoto ?? false;
  const jobStep = tier.intake === "resume+job";
  const checkoutStep = jobStep ? 3 : 2;
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

    setError(null);
    setPhase("layout");
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
        text?: string;
        file?: { filename: string; mimeType: "application/pdf"; dataBase64: string };
        jobUrl?: string;
        jobText?: string;
        jobFile?: { filename: string; mimeType: "application/pdf"; dataBase64: string };
      };
      let payload: Payload = { tier: tier.id };

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

  /** Bundle tier: hand the buyer their cover letter as a plain text file. */
  function downloadCoverLetter() {
    const letter = order?.result.coverLetter;
    if (!letter) return;
    const url = URL.createObjectURL(new Blob([letter], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "callback-cover-letter.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="paper-texture relative min-h-screen">
      <header className="px-5 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="font-stamp text-xl tracking-[0.2em] text-ink uppercase">
            Callback
          </Link>
          <Link
            to="/"
            className="font-typewriter text-sm text-ink underline decoration-redpen decoration-2 underline-offset-4 transition-colors hover:text-redpen"
          >
            Back to the front page
          </Link>
        </div>
      </header>

      <main className="px-5 pb-20">
        <div className="mx-auto max-w-5xl">
          <p className="font-typewriter text-xs tracking-[0.3em] text-redpen uppercase">
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
                  className="font-typewriter text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-redpen"
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
                <p className="mt-3 font-typewriter text-sm text-muted-foreground">
                  Built from {order.result.sourceLabel} &middot;{" "}
                  {RESUME_TEMPLATES.find((t) => t.id === order.template)?.name}
                </p>
              </div>

              <ResumeDeliverable order={order} photo={photo} />

              {order.tier === "bundle" && (
                <div className="border-2 border-redpen bg-card p-6 shadow-paper">
                  <SectionLabel step={layoutStep + 2}>The application</SectionLabel>
                  <p className="mt-3 font-typewriter text-sm leading-relaxed text-ink">
                    Tailored to{" "}
                    <span className="marker break-all">{order.result.jobUrl}</span>
                  </p>
                  {order.submissionQueued ? (
                    <p className="mt-5 font-hand text-2xl leading-tight text-redpen">
                      Queued. We submit this application for you and email you the
                      confirmation.
                    </p>
                  ) : (
                    <>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Hand it off and our team submits this application on your behalf.
                      </p>
                      <StampButton
                        type="button"
                        onClick={queueSubmission}
                        disabled={queueing}
                        className="mt-6"
                      >
                        Submit It For Me
                      </StampButton>
                    </>
                  )}
                </div>
              )}
            </section>
          ) : phase === "layout" ? (
            <section className="mt-12 space-y-8">
              <div>
                <SectionLabel step={layoutStep}>Pick your layout</SectionLabel>
                <p className="mt-3 max-w-2xl font-typewriter text-sm text-muted-foreground">
                  Payment received &mdash; every layout is unlocked. Two use a photo;
                  the rest are text only.
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

              <div className="bg-card p-6 shadow-paper sm:p-8">
                <StampButton type="button" onClick={build} disabled={pending}>
                  {pending ? "Writing..." : "Build My Résumé"}
                </StampButton>
                <p className="mt-5 font-typewriter text-xs leading-relaxed text-muted-foreground">
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

                <div className="mt-5 bg-card p-6 shadow-paper sm:p-8">
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
                        className="mt-3 w-full border border-border bg-paper p-3 font-typewriter text-sm text-ink outline-none focus:border-redpen"
                      />
                      <p className="mt-4 font-typewriter text-xs text-muted-foreground">
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
                    className="mt-2 block w-full font-typewriter text-sm text-muted-foreground file:mr-4 file:border file:border-ink file:bg-transparent file:px-4 file:py-2 file:font-stamp file:text-xs file:tracking-widest file:text-ink file:uppercase hover:file:border-redpen hover:file:text-redpen"
                  />
                  <p className="mt-2 font-typewriter text-xs text-muted-foreground">
                    {file ? `Attached: ${file.name}` : "PDF or DOCX \u00b7 up to 5MB"}
                  </p>
                </div>
              </section>

              {jobStep && (
                <section>
                  <SectionLabel step={2}>The job you want</SectionLabel>
                  <div className="mt-5 bg-card p-6 shadow-paper sm:p-8">
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
                      className="mt-3 w-full border border-border bg-paper p-3 font-typewriter text-sm text-ink outline-none focus:border-redpen"
                    />
                    <label
                      htmlFor="jobText"
                      className="mt-6 block font-typewriter text-sm tracking-widest text-ink uppercase"
                    >
                      Paste the posting text (optional, but it tailors harder)
                    </label>
                    <textarea
                      id="jobText"
                      name="jobText"
                      rows={5}
                      value={jobText}
                      onChange={(event) => setJobText(event.target.value)}
                      className="mt-3 w-full border border-border bg-paper p-3 font-typewriter text-sm text-ink outline-none focus:border-redpen"
                    />
                  </div>
                </section>
              )}

              <section>
                <SectionLabel step={checkoutStep}>Checkout</SectionLabel>
                <div className="mt-5 bg-card p-6 shadow-paper sm:p-8">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <p className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
                        {tier.name}
                      </p>
                      <p className="mt-2 font-stamp text-4xl text-ink">${tier.price}</p>
                    </div>
                    <StampButton type="submit">{`Pay $${tier.price}`}</StampButton>
                  </div>
                  <p className="mt-5 border-t border-dashed border-border pt-4 font-typewriter text-xs leading-relaxed text-redpen">
                    Placeholder checkout &mdash; no card is charged yet. Next you pick
                    your layout, add a photo if it needs one, and then we write it.
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
