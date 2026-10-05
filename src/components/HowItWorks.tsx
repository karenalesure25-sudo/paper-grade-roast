const steps = [
  {
    n: "01",
    title: "Upload",
    body: "Upload a PDF or DOCX, or paste the text. No account needed.",
    note: "PDF, DOCX, or paste",
  },
  {
    n: "02",
    title: "Get Roasted + Graded",
    body: "A letter grade, what’s working, and red-pen notes that quote your résumé or flag what’s confirmed missing.",
    note: "honest, not mean",
  },
  {
    n: "03",
    title: "Unlock the Fix",
    body: "Choose a $40, $50, or $60 service and Kay builds the fix from your real experience.",
    note: "optional paid service",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="section-shell ivory-band border-y border-accent/30">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow">A clear three-step process</p>
        <h2 className="section-title mt-4">How it works</h2>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="bg-card p-6 sm:p-8"
            >
              <span className="font-brand text-4xl text-accent">
                {s.n}
              </span>
              <div>
                <h3 className="mt-6 font-brand-sub text-xl text-ivory">
                  {s.title}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-muted-foreground">
                  {s.body}
                </p>
              </div>
              <p className="mt-5 border-t border-border pt-4 text-xs font-semibold tracking-[0.08em] text-accent uppercase">
                {s.note}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
