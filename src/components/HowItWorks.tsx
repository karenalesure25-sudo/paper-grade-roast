const steps = [
  {
    n: "01",
    title: "Upload",
    body: "Drop in a PDF or DOCX. No account, no forms, no waiting room.",
    note: "takes 4 seconds",
  },
  {
    n: "02",
    title: "Get Roasted + Graded",
    body: "A letter grade, line-by-line red pen, and the one thing recruiters skip past.",
    note: "brutal but fair",
  },
  {
    n: "03",
    title: "Unlock the Fix",
    body: "Turn every note into rewritten bullets that actually clear the ATS.",
    note: "this is the good part",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-[1.7rem] leading-tight text-ink uppercase sm:text-4xl">
          How the grading works
        </h2>
        <div className="gold-rule mt-4 w-40" />

        <ol className="mt-12 space-y-10 sm:mt-16 sm:space-y-14">
          {steps.map((s) => (
            <li
              key={s.n}
              className="grid gap-x-8 gap-y-3 border-b border-dashed border-border pb-8 sm:grid-cols-[7rem_1fr_13rem] sm:items-baseline"
            >
              <span className="gold-foil font-display text-4xl sm:text-5xl">
                {s.n}
              </span>
              <div>
                <h3 className="font-sans text-xl font-bold text-ink sm:text-2xl">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-md text-[0.975rem] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
              <p className="font-hand text-2xl leading-tight text-ink-soft sm:-rotate-3 sm:text-right">
                {s.note}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
