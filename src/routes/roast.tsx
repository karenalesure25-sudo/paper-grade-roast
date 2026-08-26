import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { StampButton } from "@/components/StampButton";
import { GradedPaperCard } from "@/components/GradedPaperCard";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PricingTiers } from "@/components/PricingTiers";
import type { TemplateId } from "@/lib/resume-templates";
import { SiteFooter } from "@/components/SiteFooter";
import { roastResume } from "@/lib/roast.functions";
import { prepareUpload } from "@/lib/prepare-upload";
import { readRoasts, saveRoast, clearRoasts, type StoredRoast } from "@/lib/roast-session";

export const Route = createFileRoute("/roast")({
  head: () => ({
    meta: [
      { title: "Grade My Resume — Callback" },
      {
        name: "description",
        content:
          "Upload your resume as a PDF or DOCX and get an instant letter grade, a short roast, and the red-pen notes that matter. Free.",
      },
      { property: "og:title", content: "Grade My Resume — Callback" },
      {
        property: "og:description",
        content: "Upload it. Get roasted. Get better. Free.",
      },
    ],
  }),
  component: RoastPage,
});

function RoastPage() {
  const grade = useServerFn(roastResume);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<StoredRoast | null>(null);
  const [history, setHistory] = useState<StoredRoast[]>([]);
  const [preview, setPreview] = useState<TemplateId>("sidebar");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const input = form.elements.namedItem("resumeFile") as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      setError("Upload a PDF or DOCX file to get it graded.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const prepared = await prepareUpload(file);
      const payload =
        prepared.kind === "pdf"
          ? {
              file: {
                filename: prepared.filename,
                mimeType: prepared.mimeType,
                dataBase64: prepared.dataBase64,
              },
            }
          : { text: prepared.text };

      const result = await grade({ data: payload });
      const stored = saveRoast({
        ...result,
        label: file.name,
      });
      setCurrent(stored);
      setHistory(readRoasts().filter((r) => r.id !== stored.id));
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Something went wrong on the way to the grader. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="paper-texture relative min-h-screen">
      <header className="px-5 py-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link to="/" className="font-stamp text-xl tracking-[0.2em] text-ink uppercase">
            Callback
          </Link>
          <Link
            to="/"
            className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft decoration-2 underline-offset-4 transition-colors hover:text-ink"
          >
            Back to the front page
          </Link>
        </div>
      </header>

      <main className="px-5 pb-20">
        <div className="mx-auto max-w-4xl">
          <p className="font-typewriter text-xs tracking-[0.3em] text-ink-soft uppercase">
            Hand it in
          </p>
          <h1 className="mt-4 font-stamp text-[2.2rem] leading-[1.1] text-ink sm:text-5xl">
            Grade my resume
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Upload a PDF or DOCX. Nothing you submit is stored on our end &mdash; your
            roast lives in this browser tab and disappears when you close it.
          </p>

          <form onSubmit={submit} className="mt-10 bg-card p-6 shadow-paper sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <label
                  htmlFor="resumeFile"
                  className="font-typewriter text-sm tracking-widest text-ink uppercase"
                >
                  Upload your resume
                </label>
                <input
                  id="resumeFile"
                  name="resumeFile"
                  type="file"
                  accept=".pdf,.docx,application/pdf"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  className="mt-2 block w-full font-typewriter text-sm text-muted-foreground file:mr-4 file:border file:border-ink file:bg-transparent file:px-4 file:py-2 file:font-stamp file:text-xs file:tracking-widest file:text-ink file:uppercase hover:file:border-ink-soft hover:file:text-ink"
                />
                <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
                  {fileName ? `Attached: ${fileName}` : "PDF or DOCX \u00b7 up to 5MB"}
                </p>
              </div>
              <StampButton type="submit" disabled={pending} className="shrink-0">
                {pending ? "Grading..." : "Grade it"}
              </StampButton>
            </div>

            {error && (
              <p className="mt-5 font-hand text-2xl leading-tight text-redpen">{error}</p>
            )}
          </form>

          {current && (
            <>
              <section className="mt-14">
                <h2 className="font-stamp text-2xl text-ink sm:text-3xl">Your grade</h2>
                <div className="mt-3 h-px w-20 bg-redpen" />
                <div className="mt-8">
                  <GradedPaperCard roast={current} />
                </div>
              </section>

              <section className="mt-16">
                <h2 className="font-stamp text-2xl text-ink sm:text-3xl">
                  Now pick the paper it lands on
                </h2>
                <div className="mt-3 h-px w-20 bg-redpen" />
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  Three layouts, shown here as samples with fake details and a blank photo
                  slot. They unblur the moment you buy a fix.
                </p>
                <div className="mt-8">
                  <TemplatePicker
                    value={preview}
                    onChange={setPreview}
                    unlocked={false}
                  />
                </div>
                <div className="mt-12">
                  <PricingTiers />
                </div>
              </section>
            </>
          )}


          {history.length > 0 && (
            <section className="mt-16">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-stamp text-xl text-ink">Earlier this session</h2>
                <button
                  type="button"
                  onClick={() => {
                    clearRoasts();
                    setHistory([]);
                    setCurrent(null);
                  }}
                  className="font-sans text-[0.95rem] text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
                >
                  Clear this session
                </button>
              </div>
              <ul className="mt-6 space-y-3">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-4 border border-border bg-card/70 px-4 py-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-redpen font-stamp text-lg text-redpen">
                      {entry.grade}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrent(entry)}
                      className="min-w-0 flex-1 text-left font-sans text-[0.95rem] text-ink transition-colors hover:text-ink"
                    >
                      <span className="block truncate">{entry.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.roast}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
