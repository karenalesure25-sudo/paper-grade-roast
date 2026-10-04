import { useEffect, useRef, useState } from "react";
import { BrandLink } from "@/components/BrandMark";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { StampButton } from "@/components/StampButton";
import { GradedPaperCard } from "@/components/GradedPaperCard";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PricingTiers } from "@/components/PricingTiers";
import { RESUME_TEMPLATES, type TemplateId } from "@/lib/resume-templates";
import { SiteFooter } from "@/components/SiteFooter";
import { roastResume } from "@/lib/roast.functions";
import { prepareUpload } from "@/lib/prepare-upload";
import { readRoasts, saveRoast, clearRoasts, type StoredRoast } from "@/lib/roast-session";

export const Route = createFileRoute("/roast")({
  head: () => ({
    meta: [
      { title: "Free Resume Roast — Kay’s Career Solutions" },
      {
        name: "description",
        content:
          "Upload a PDF or DOCX, or paste your résumé text, for a free letter grade and red-pen notes quoted from your own résumé.",
      },
      { property: "og:title", content: "Free Resume Roast — Kay’s Career Solutions" },
      { property: "og:description", content: "A letter grade and red-pen notes, backed by quotes from your résumé." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoastPage,
});

const MAX_PASTE = 24000;

function RoastPage() {
  const grade = useServerFn(roastResume);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<StoredRoast | null>(null);
  const [history, setHistory] = useState<StoredRoast[]>([]);
  const [preview, setPreview] = useState<TemplateId>("sidebar");
  const requestId = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHistory(readRoasts()), []);

  /** Any change to the input invalidates what's on screen. */
  function resetResult() {
    setCurrent(null);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const id = ++requestId.current;
    setCurrent(null);
    setError(null);

    const selected = file ?? fileRef.current?.files?.[0] ?? null;
    if (mode === "file" && !selected) return setError("Choose a PDF or DOCX file first.");
    if (mode === "paste" && pasted.trim().length < 200)
      return setError("Paste your full résumé text (at least a few lines).");

    setPending(true);
    try {
      let payload:
        | { source: "pdf"; filename: string; dataBase64: string }
        | { source: "docx" | "text"; filename?: string; text: string };
      if (mode === "paste") {
        payload = { source: "text", text: pasted.slice(0, MAX_PASTE) };
      } else {
        const prepared = await prepareUpload(selected!);
        payload =
          prepared.kind === "pdf"
            ? { source: "pdf", filename: prepared.filename, dataBase64: prepared.dataBase64 }
            : { source: "docx", filename: prepared.filename, text: prepared.text.slice(0, MAX_PASTE) };
      }
      const result = await grade({ data: payload });
      if (id !== requestId.current) return; // input changed while we waited
      if (result.status !== "graded") {
        setError(result.message);
        return;
      }
      const stored = saveRoast(result);
      setCurrent(stored);
      setHistory(readRoasts());
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(
        cause instanceof Error && cause.message && cause.message.length < 200
          ? cause.message
          : "Something went wrong reaching the grader. Try again.",
      );
    } finally {
      if (id === requestId.current) setPending(false);
    }
  }

  const tabCls = (active: boolean) =>
    `flex-1 border px-4 py-3 font-stamp text-xs tracking-widest uppercase transition-colors ${
      active ? "border-redpen bg-paper-shade text-ink" : "border-border text-muted-foreground hover:text-ink"
    }`;

  return (
    <div className="paper-texture relative min-h-screen">
      <header className="px-5 py-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <BrandLink size="sm" withTagline={false} />
          <Link to="/" className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft underline-offset-4">
            Home
          </Link>
        </div>
      </header>

      <main className="px-5 pb-20">
        <div className="mx-auto max-w-4xl">
          <p className="font-typewriter text-xs tracking-[0.3em] text-ink-soft uppercase">Free resume roast</p>
          <h1 className="mt-4 font-stamp text-[2.2rem] leading-[1.1] text-ink sm:text-5xl">Grade my resume</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Upload a PDF or DOCX, or paste the text. Every note quotes your own résumé. Your text is sent to an
            AI service to be graded; results stay in this browser tab. See our{" "}
            <Link to="/privacy" className="underline underline-offset-4">privacy page</Link>.
          </p>

          <form onSubmit={submit} className="mt-10 border border-border bg-card p-6 shadow-paper sm:p-8" aria-busy={pending}>
            <div role="tablist" aria-label="How to send your résumé" className="flex gap-3">
              <button type="button" role="tab" aria-selected={mode === "file"} disabled={pending}
                onClick={() => { setMode("file"); resetResult(); }} className={tabCls(mode === "file")}>
                Upload file
              </button>
              <button type="button" role="tab" aria-selected={mode === "paste"} disabled={pending}
                onClick={() => { setMode("paste"); resetResult(); }} className={tabCls(mode === "paste")}>
                Paste text
              </button>
            </div>

            <fieldset disabled={pending} className="mt-6">
              {mode === "file" ? (
                <div>
                  <label htmlFor="resumeFile" className="font-typewriter text-sm tracking-widest text-ink uppercase">
                    Your résumé (PDF or DOCX)
                  </label>
                  <input
                    ref={fileRef}
                    id="resumeFile"
                    name="resumeFile"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => { setFile(e.target.files?.[0] ?? null); resetResult(); }}
                    className="mt-2 block w-full font-sans text-[0.95rem] text-muted-foreground file:mr-4 file:border file:border-ink file:bg-transparent file:px-4 file:py-3 file:font-stamp file:text-xs file:tracking-widest file:text-ink file:uppercase"
                  />
                  <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
                    {file ? `Attached: ${file.name}` : "PDF or DOCX · up to 5 MB · scanned image PDFs can't be read"}
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor="resumeText" className="font-typewriter text-sm tracking-widest text-ink uppercase">
                    Paste your résumé text
                  </label>
                  <textarea
                    id="resumeText"
                    rows={12}
                    maxLength={MAX_PASTE}
                    value={pasted}
                    onChange={(e) => { setPasted(e.target.value); resetResult(); }}
                    className="mt-2 w-full border border-border bg-paper-shade p-3 font-sans text-[16px] text-ink outline-none focus:border-redpen"
                  />
                  <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
                    {pasted.length.toLocaleString()} / {MAX_PASTE.toLocaleString()} characters
                  </p>
                </div>
              )}
            </fieldset>

            <div className="mt-6">
              <StampButton type="submit" disabled={pending}>{pending ? "Grading..." : "Grade it"}</StampButton>
            </div>

            <div role="status" aria-live="polite" className="mt-5">
              {pending && <p className="font-sans text-[0.95rem] text-muted-foreground">Reading and grading your résumé…</p>}
            </div>
            <div role="alert" aria-live="assertive">
              {error && <p className="font-sans text-[1rem] leading-relaxed text-redpen">{error}</p>}
            </div>
          </form>

          {current && (
            <>
              <section className="mt-14" aria-labelledby="result-heading">
                <h2 id="result-heading" className="font-stamp text-2xl text-ink sm:text-3xl">
                  Your grade: {current.grade}
                </h2>
                <div className="mt-8">
                  <GradedPaperCard roast={current} />
                </div>
              </section>

              <section className="mt-16">
                <h2 className="font-stamp text-2xl text-ink sm:text-3xl">Want Kay to fix it?</h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  {RESUME_TEMPLATES.length} layouts, shown as blurred samples with placeholder details.
                </p>
                <div className="mt-8">
                  <TemplatePicker value={preview} onChange={setPreview} unlocked={false} />
                </div>
                <div className="mt-12">
                  <PricingTiers />
                </div>
              </section>
            </>
          )}

          {history.length > 0 && (
            <section className="mt-16" aria-labelledby="history-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="history-heading" className="font-stamp text-xl text-ink">This browser session</h2>
                <button
                  type="button"
                  onClick={() => { clearRoasts(); setHistory([]); setCurrent(null); }}
                  className="font-sans text-[0.95rem] text-muted-foreground underline underline-offset-4 hover:text-ink"
                >
                  Clear my results
                </button>
              </div>
              <ul className="mt-6 space-y-3">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-4 border border-border bg-paper-shade px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border font-stamp text-lg text-ink-soft">
                      {entry.grade}
                    </span>
                    <button type="button" onClick={() => setCurrent(entry)} className="min-w-0 flex-1 text-left font-sans text-[0.95rem] text-ink">
                      <span className="block truncate">{entry.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{entry.roast}</span>
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
