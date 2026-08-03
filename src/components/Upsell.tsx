import { PricingTiers } from "@/components/PricingTiers";

export function Upsell() {
  return (
    <section id="rewrite" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="font-stamp text-[2rem] leading-[1.15] text-ink sm:text-5xl">
            The roast was free.
            <br />
            <span className="text-redpen">The fix isn&apos;t.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Knowing your résumé is a C- doesn&apos;t get you an interview. The fix
            does: real edits by line, scored against the ATS filters that were
            throwing you out before a human ever opened the file. Three ways in,
            depending on what you&apos;re starting with.
          </p>
        </div>

        <div className="mt-12">
          <PricingTiers />
        </div>

        <p className="mt-8 text-center font-typewriter text-xs text-muted-foreground">
          48-hour turnaround &middot; three templates to choose from &middot; refund if
          your score doesn&apos;t move
        </p>
      </div>
    </section>
  );
}

