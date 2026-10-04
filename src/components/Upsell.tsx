import { PricingTiers } from "@/components/PricingTiers";
import { RESUME_TEMPLATES } from "@/lib/resume-templates";


export function Upsell() {
  return (
    <section id="services" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="font-display text-[1.9rem] leading-[1.15] text-ink uppercase sm:text-[2.75rem]">
            The grade is free.
            <br />
            <span className="gold-foil">The fix isn&apos;t.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Pick the service that matches where you&apos;re starting: improve the
            résumé you have, build one from scratch, or tailor it to one specific job
            with a matching cover letter.
          </p>
        </div>

        <div className="mt-12">
          <PricingTiers />
        </div>

        <p className="mt-8 text-center font-sans text-[0.85rem] text-muted-foreground">
          48-hour turnaround &middot; {RESUME_TEMPLATES.length} templates to choose from
        </p>

      </div>
    </section>
  );
}

