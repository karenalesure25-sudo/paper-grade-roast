import { GradeStamp } from "@/components/GradeStamp";

const roasts = [
  {
    grade: "C",
    name: "marketing_resume_FINAL_v7.pdf",
    quote: "Results-driven team player",
    critique: "This phrase is broad. Replace it with a specific contribution from the role.",
    note: "Specific beats generic.",
  },
  {
    grade: "B",
    name: "swe_resume_2026.pdf",
    quote: "Helped the team complete projects",
    critique: "Name your action first, then add the verified outcome if the résumé supports one.",
    note: "Own the action.",
  },
  {
    grade: "D",
    name: "my resume (1) (1).docx",
    quote: "Responsible for handling customer calls",
    critique: "This shows a duty, but not the result of doing it well.",
    note: "Show the outcome.",
  },
];

export function RoastCards() {
  return (
    <section id="free-roast" className="section-shell border-y border-border/70 bg-surface-subtle">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <p className="eyebrow">The free résumé roast</p>
          <h2 className="section-title mt-4">Feedback grounded in the words on your résumé.</h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">These illustrative samples show the format. Your result is generated from your own source and must pass accuracy checks before it appears.</p>
        </div>

        <div className="mt-12 grid gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {roasts.map((r, i) => (
            <article
              key={r.name}
              className="service-card relative px-6 pt-7 pb-8"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-typewriter text-[0.7rem] tracking-widest text-muted-foreground uppercase">
                    Example {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1 truncate font-sans text-[0.95rem] text-ink">
                    {r.name}
                  </p>
                </div>
                <GradeStamp grade={r.grade} delay={i * 220} />
              </div>

              <div className="mt-6 space-y-3 border-l-2 border-gold/60 pl-4">
                <p className="text-xs font-semibold tracking-[0.08em] text-gold uppercase">Evidence quote</p>
                <blockquote className="text-sm leading-6 text-ivory">&ldquo;{r.quote}&rdquo;</blockquote>
                <p className="font-sans text-[0.95rem] leading-[1.9rem] text-ink">
                  {r.critique}
                </p>
              </div>

              <p className="mt-5 font-hand text-2xl leading-none text-redpen-text">
                {r.note}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
