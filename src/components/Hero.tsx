import { StampLink } from "@/components/StampButton";
import { Briefcase, Rocket, TrendingUp, Trophy } from "lucide-react";
import { GradeStamp } from "@/components/GradeStamp";

const badges = [
  { label: "Get Noticed", Icon: Briefcase },
  { label: "Stand Out", Icon: Rocket },
  { label: "Get Interviews", Icon: TrendingUp },
  { label: "Achieve Your Goals", Icon: Trophy },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pt-10 pb-16 sm:pt-14 sm:pb-24">
      {/* crimson ribbon headline band, flyer-style */}
      <div className="mx-auto max-w-6xl">
        <div className="ribbon gold-frame px-6 py-6 text-center sm:px-10 sm:py-8">
          <h1 className="font-display text-[2.1rem] leading-[1.05] tracking-tight text-ink uppercase sm:text-5xl lg:text-6xl">
            Land your{" "}
            <span className="gold-foil">dream job</span>
          </h1>
        </div>
        <p className="mt-4 text-center font-sans text-[0.68rem] font-semibold tracking-[0.28em] text-gold uppercase sm:text-xs">
          Professional &middot; Confident &middot; Ready for Opportunity
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <div>
          <p className="font-sans text-[0.7rem] font-semibold tracking-[0.3em] text-ink-soft uppercase">
            Resume grading, red pen included
          </p>
          <h2 className="mt-5 font-display text-[2rem] leading-[1.12] text-ink sm:text-[2.75rem]">
            Your resume just got{" "}
            <span className="pen-underline relative inline-block">graded.</span>
          </h2>
          <p className="mt-6 max-w-md font-sans text-[1.05rem] leading-relaxed text-muted-foreground sm:text-lg">
            Upload it. Get graded. Get better.{" "}
            <span className="marker font-semibold">Free.</span> Then let Kay
            polish, optimize and elevate the whole thing.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-5">
            <StampLink to="/roast">Grade My Resume</StampLink>
            <p className="font-sans text-[0.95rem] text-muted-foreground">
              No signup. 30 seconds.
            </p>
          </div>

          <ul className="mt-11 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {badges.map((b) => (
              <li key={b.label} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-card">
                  <b.Icon className="h-5 w-5 text-gold" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="font-sans text-[0.65rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
                  {b.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Graded paper sample */}
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="absolute inset-x-4 top-4 h-full bg-card/70 shadow-paper rotate-[3deg]" />
          <div className="absolute inset-x-2 top-2 h-full bg-card/85 shadow-paper -rotate-[1.5deg]" />
          <div className="torn-edge gold-frame relative bg-card px-6 pt-8 pb-10 shadow-paper-lift rotate-[0.6deg] sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[0.65rem] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  Name
                </p>
                <p className="mt-1 font-sans text-lg text-ink">A. Candidate</p>
              </div>
              <GradeStamp grade="C+" delay={500} />
            </div>

            <div className="ruled-lines mt-7">
              <p className="font-sans text-[0.95rem] leading-[1.9rem] text-ink">
                Passionate, results-driven professional with a proven track record
                of leveraging synergies to help drive impactful outcomes across
                cross-functional teams.
              </p>
            </div>

            <p className="mt-6 max-w-[16rem] font-hand text-2xl leading-tight text-ink-soft -rotate-2">
              Nine words in and I still don&apos;t know what you do.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
