import { StampLink } from "@/components/StampButton";
import { ArrowRight, CheckCircle2, FileText, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="luxury-hero relative overflow-hidden border-b border-border/60 px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-20">
          <div className="max-w-2xl">
          <p className="eyebrow">Career clarity for what&rsquo;s next</p>
          <h1 className="mt-5 font-brand text-[2.8rem] font-semibold leading-[0.96] text-ivory sm:text-6xl lg:text-[4.5rem]">
            Make your experience <span className="gold-foil">impossible to overlook.</span>
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Get honest feedback grounded in your résumé before you invest in a professional rewrite. Upload or paste for a clear grade and useful next step. Professional services start at $40.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <StampLink to="/roast">Get My Free Roast <ArrowRight className="size-4" /></StampLink>
            <a href="#services" className="secondary-button">View Services</a>
          </div>
          <div className="mt-8 grid max-w-xl gap-3 text-sm text-ivory-muted sm:grid-cols-3">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> No signup</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> PDF, DOCX, or paste</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Fact-checked</span>
          </div>
        </div>

        {/* Illustrative source and review — no customer or outcome claim. */}
        <figure className="relative mx-auto w-full max-w-xl pb-10 sm:pr-10">
          <div aria-hidden className="absolute -left-5 top-8 hidden size-16 place-items-center rounded-2xl border border-accent/30 bg-card text-accent shadow-paper sm:grid"><FileText className="size-7" /></div>
          <div className="resume-sheet relative min-h-[360px] rounded-lg border border-accent/25 bg-ivory p-6 text-board shadow-paper-lift sm:min-h-[400px] sm:p-8">
            <div className="border-b border-board/20 pb-4">
              <p className="font-brand text-3xl font-bold">Jordan Ellis</p>
              <p className="mt-1 text-xs font-semibold uppercase text-board/65">Customer Support Professional</p>
            </div>
            <p className="mt-6 text-xs font-bold uppercase">Experience</p>
            <p className="mt-3 text-sm font-semibold">Source bullet</p>
            <p className="mt-2 text-sm leading-6">&ldquo;Responsible for handling customer calls and resolving account questions.&rdquo;</p>
            <div className="mt-8 space-y-2 opacity-40"><div className="h-1.5 w-full bg-board" /><div className="h-1.5 w-11/12 bg-board" /><div className="h-1.5 w-4/5 bg-board" /></div>
          </div>
          <div className="review-note relative -mt-20 ml-4 rounded-lg border border-accent/45 bg-card p-5 shadow-paper-lift sm:absolute sm:-bottom-1 sm:right-0 sm:ml-0 sm:w-[72%]">
            <p className="eyebrow">Illustrative example</p>
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-accent"><Sparkles className="mt-0.5 size-4 shrink-0" />Lead with the action, not the responsibility.</p>
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
