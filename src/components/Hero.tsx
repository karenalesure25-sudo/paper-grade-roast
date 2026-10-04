import { StampLink } from "@/components/StampButton";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <section className="luxury-hero relative overflow-hidden border-b border-border/60 px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <div className="relative mx-auto max-w-7xl border border-gold/35 p-5 sm:p-10 lg:p-14">
        <span aria-hidden className="absolute left-4 top-4 size-6 border-l border-t border-gold sm:left-6 sm:top-6" />
        <span aria-hidden className="absolute bottom-4 right-4 size-6 border-b border-r border-gold sm:bottom-6 sm:right-6" />
        <div className="mx-auto flex max-w-3xl justify-center">
          <img src="/brand/kays-career-solutions-metallic.webp" alt="Kay's Career Solutions — Polish, Optimize, Elevate" width="2172" height="724" fetchPriority="high" className="h-auto w-full max-w-[620px] object-contain" />
        </div>

        <div className="mt-8 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <div className="max-w-2xl">
          <p className="eyebrow">Free, résumé-specific feedback</p>
          <h1 className="mt-5 font-brand text-[2.8rem] font-semibold leading-[0.94] text-ivory sm:text-6xl lg:text-[4.4rem]">
            Your experience deserves a <span className="gold-foil">stronger résumé.</span>
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Get honest feedback grounded in your résumé before you invest in a professional rewrite. Upload or paste for a clear grade and useful next step. Professional services start at $40.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <StampLink to="/roast">Get My Free Roast <ArrowRight className="size-4" /></StampLink>
            <a href="#services" className="secondary-button">View Services</a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ivory-muted">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-gold" /> No signup</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-gold" /> PDF, DOCX, or paste</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-gold" /> Fact-checked before display</span>
          </div>
        </div>

        {/* Illustrative source and review — no customer or outcome claim. */}
        <figure className="relative mx-auto w-full max-w-xl pb-10 sm:pr-10">
          <div className="resume-sheet relative min-h-[360px] border border-gold/35 bg-ivory p-6 text-board shadow-paper-lift sm:min-h-[400px] sm:p-8">
            <div className="border-b border-board/20 pb-4">
              <p className="font-brand text-3xl font-bold">Jordan Ellis</p>
              <p className="mt-1 text-xs font-semibold uppercase text-board/65">Customer Support Professional</p>
            </div>
            <p className="mt-6 text-xs font-bold uppercase">Experience</p>
            <p className="mt-3 text-sm font-semibold">Source bullet</p>
            <p className="mt-2 text-sm leading-6">&ldquo;Responsible for handling customer calls and resolving account questions.&rdquo;</p>
            <div className="mt-8 space-y-2 opacity-40"><div className="h-1.5 w-full bg-board" /><div className="h-1.5 w-11/12 bg-board" /><div className="h-1.5 w-4/5 bg-board" /></div>
          </div>
          <div className="review-note relative -mt-20 ml-4 border border-gold bg-card p-5 shadow-paper-lift sm:absolute sm:-bottom-1 sm:right-0 sm:ml-0 sm:w-[72%]">
            <p className="eyebrow">Illustrative example</p>
            <p className="mt-3 text-sm font-semibold text-redpen-text">Lead with the action, not the responsibility.</p>
            <p className="mt-3 text-sm leading-6 text-ivory">Suggested rewrite: &ldquo;Handled customer calls and resolved account questions.&rdquo;</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Add a result only if you can verify it.</p>
            </div>
          <figcaption className="sr-only">Illustrative résumé and truthful rewrite example, not a customer result.</figcaption>
        </figure>
        </div>
      </div>
    </section>
  );
}
