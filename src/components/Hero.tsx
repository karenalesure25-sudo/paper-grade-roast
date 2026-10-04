import { StampLink } from "@/components/StampButton";
import { GradeStamp } from "@/components/GradeStamp";

export function Hero() {
  return (
    <section className="relative px-5 pt-8 pb-14 sm:pt-12 sm:pb-20">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <div>
          <p className="font-sans text-[0.72rem] font-semibold tracking-[0.3em] text-gold uppercase">
            Free · No signup
          </p>
          <h1 className="mt-4 font-display text-[2.2rem] leading-[1.08] text-ink uppercase sm:text-5xl">
            Get your free <span className="gold-foil">resume roast</span>
          </h1>
          <p className="mt-6 max-w-lg font-sans text-[1.05rem] leading-relaxed text-muted-foreground sm:text-lg">
            Upload a PDF or DOCX, or paste the text. You get a letter grade, what&rsquo;s working,
            and red-pen notes &mdash; each one quoting a line from your own résumé, so you know
            exactly what to fix.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <StampLink to="/roast">Get My Free Roast</StampLink>
            <a href="#services" className="font-sans text-[0.95rem] text-ink underline decoration-gold underline-offset-4">
              Or see résumé services
            </a>
          </div>
        </div>

        {/* Sample result — illustrative, not a real customer */}
        <figure className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="gold-frame relative bg-card px-6 pt-7 pb-8 shadow-paper-lift sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[0.65rem] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  Sample result
                </p>
                <p className="mt-1 font-sans text-lg text-ink">Example résumé</p>
              </div>
              <GradeStamp grade="C" delay={400} />
            </div>
            <p className="mt-6 font-hand text-2xl leading-tight text-redpen">
              Says what you were responsible for, not what changed because of you.
            </p>
            <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
              From the résumé: &ldquo;Responsible for handling customer calls and other duties as assigned&rdquo;
            </p>
            <div className="mt-6 border-l-2 border-redpen pl-4">
              <p className="font-typewriter text-[0.65rem] tracking-[0.22em] text-ink-soft uppercase">The one fix</p>
              <p className="mt-1 font-sans text-[0.9rem] text-ink">
                Lead with the outcome, using a real number if you have one: &ldquo;Resolved customer calls…&rdquo;
              </p>
            </div>
          </div>
          <figcaption className="mt-3 text-center font-sans text-[0.75rem] text-muted-foreground">
            Illustrative example. Your notes come from your own résumé.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
