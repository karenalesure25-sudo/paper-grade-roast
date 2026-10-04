const steps = [
  {
    n: "01",
    title: "Upload",
    body: "Upload a PDF or DOCX, or paste the text. No account needed.",
    note: "takes 4 seconds",
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
