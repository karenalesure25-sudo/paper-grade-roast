import { GradeStamp } from "@/components/GradeStamp";

const roasts = [
  {
    grade: "C-",
    name: "marketing_resume_FINAL_v7.pdf",
    critique:
      "\u201cResults-driven team player\u201d appears twice and means nothing either time.",
    note: "Say what you actually did.",
    rotate: "sm:-rotate-2",
    offset: "sm:translate-y-0",
  },
  {
    grade: "B",
    name: "swe_resume_2026.pdf",
    critique:
      "Six years of work compressed into bullets that all start with \u201cHelped.\u201d",
    note: "Lead with numbers.",
    rotate: "sm:rotate-[1.5deg]",
    offset: "sm:translate-y-6",
  },
  {
    grade: "D+",
    name: "my resume (1) (1).docx",
    critique:
      "Your objective statement is addressed to a company you stopped applying to in 2021.",
    note: "Cut the objective. Entirely.",
    rotate: "sm:-rotate-1",
    offset: "sm:translate-y-2",
  },
];

export function RoastCards() {
  return (
    <section className="border-y border-border/70 bg-paper-shade/50 px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <p className="font-typewriter text-xs tracking-[0.28em] text-redpen uppercase">
            From the grading pile
          </p>
          <h2 className="mt-3 font-stamp text-3xl leading-tight text-ink sm:text-4xl">
            Real papers. Real red pen.
          </h2>
        </div>

        <div className="mt-12 grid gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {roasts.map((r, i) => (
            <article
              key={r.name}
              className={`group torn-edge relative bg-card px-6 pt-7 pb-9 shadow-paper transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-paper-lift ${r.rotate} ${r.offset}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-typewriter text-[0.7rem] tracking-widest text-muted-foreground uppercase">
                    Submission {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1 truncate font-typewriter text-sm text-ink">
                    {r.name}
                  </p>
                </div>
                <GradeStamp grade={r.grade} delay={i * 220} />
              </div>

              <div className="ruled-lines mt-6 space-y-1 pb-2">
                <p className="font-typewriter text-[0.95rem] leading-[1.9rem] text-ink">
                  {r.critique}
                </p>
              </div>

              <p className="mt-5 font-hand text-2xl leading-none text-redpen">
                {r.note}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
