import { StampButton } from "@/components/StampButton";
import { GradeStamp } from "@/components/GradeStamp";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pt-14 pb-20 sm:pt-20 sm:pb-28">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
        <div>
          <p className="font-typewriter text-xs tracking-[0.3em] text-redpen uppercase">
            Resume grading, red pen included
          </p>
          <h1 className="mt-6 font-stamp text-[2.6rem] leading-[1.08] text-ink sm:text-6xl lg:text-[4.25rem]">
            Your resume just got{" "}
            <span className="pen-underline relative inline-block">graded.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Upload it. Get roasted. Get better.{" "}
            <span className="marker font-semibold text-ink">Free.</span>
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
            <StampButton>Grade My Resume</StampButton>
            <p className="font-typewriter text-sm text-muted-foreground">
              No signup. 30 seconds.
            </p>
          </div>
        </div>

        {/* Graded paper sample */}
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="absolute inset-x-4 top-4 h-full bg-card/70 shadow-paper rotate-[3deg]" />
          <div className="absolute inset-x-2 top-2 h-full bg-card/85 shadow-paper -rotate-[1.5deg]" />
          <div className="torn-edge relative bg-card px-6 pt-8 pb-10 shadow-paper-lift rotate-[0.6deg] sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-typewriter text-[0.7rem] tracking-[0.22em] text-muted-foreground uppercase">
                  Name
                </p>
                <p className="mt-1 font-typewriter text-lg text-ink">A. Candidate</p>
              </div>
              <GradeStamp grade="C+" delay={500} />
            </div>

            <div className="ruled-lines mt-7">
              <p className="font-typewriter text-[0.95rem] leading-[1.9rem] text-ink">
                Passionate, results-driven professional with a proven track record
                of leveraging synergies to help drive impactful outcomes across
                cross-functional teams.
              </p>
            </div>

            <p className="mt-6 max-w-[16rem] font-hand text-2xl leading-tight text-redpen -rotate-2">
              Nine words in and I still don&apos;t know what you do.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
