import { PricingTiers } from "@/components/PricingTiers";
import { RESUME_TEMPLATES } from "@/lib/resume-templates";


export function Upsell() {
  return (
    <section id="services" className="section-shell">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 border-b border-border pb-8 sm:grid-cols-[auto_1fr] sm:items-end">
          <span className="gold-foil font-brand text-7xl leading-none">03</span>
          <div className="max-w-2xl">
          <p className="eyebrow">Professional résumé services</p>
          <h2 className="section-title mt-4">A focused service for every starting point.</h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Pick the service that matches where you&apos;re starting: improve the
            résumé you have, build one from scratch, or tailor it to one specific job
            with a matching cover letter.
          </p>
          </div>
        </div>

        <div className="mt-12">
          <PricingTiers />
        </div>

        <p className="mt-8 text-center font-sans text-[0.85rem] text-muted-foreground">
          {RESUME_TEMPLATES.length} professional templates to preview &middot; Secure checkout by Stripe
        </p>

      </div>
    </section>
  );
}

