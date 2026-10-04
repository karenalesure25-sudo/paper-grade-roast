import { StampLink } from "@/components/StampButton";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16">
        <div className="max-w-3xl">
          <p className="eyebrow">Kay&rsquo;s Career Solutions · Free résumé tool</p>
          <h1 className="mt-5 font-brand text-[2.75rem] leading-[0.98] text-ivory sm:text-6xl lg:text-[4.6rem]">
            Your next career move starts with a <span className="gold-foil">stronger résumé.</span>
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Get honest, résumé-specific feedback before you invest in a professional rewrite. Upload your file or paste the text for a grounded grade, clear strengths, and one useful next step.
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

        {/* Sample result — illustrative, not a real customer */}
        <figure className="relative mx-auto w-full max-w-lg">
          <div className="premium-panel relative overflow-hidden p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div><p className="eyebrow">Illustrative sample</p><p className="mt-2 font-brand-sub text-xl text-ivory">Jordan Ellis</p></div>
              <span className="grid size-14 place-items-center rounded-full border-2 border-redpen text-xl font-bold text-redpen-text">C</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-[1fr_0.8fr]">
              <div className="space-y-3">
                <div className="h-2 w-4/5 bg-ivory/80" /><div className="h-2 w-full bg-ivory/20" /><div className="h-2 w-11/12 bg-ivory/20" /><div className="h-2 w-3/4 bg-ivory/20" />
                <p className="pt-3 text-sm leading-6 text-ivory">&ldquo;Responsible for handling customer calls and other duties as assigned.&rdquo;</p>
              </div>
              <div className="border-l-2 border-redpen pl-4">
                <p className="text-sm font-semibold leading-6 text-redpen-text">This states responsibility, not impact.</p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">Lead with the outcome. Add a real number only when you can verify it.</p>
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">Illustrative example, not a customer result.</figcaption>
        </figure>
      </div>
    </section>
  );
}
