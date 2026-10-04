import { Link } from "@tanstack/react-router";
import { TIERS } from "@/lib/products";
import { stampClasses } from "@/components/StampButton";
import { cn } from "@/lib/utils";

/** The three paid tiers, each linking to its own flow. */
export function PricingTiers() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {TIERS.map((tier, index) => {
        const featured = tier.id === "bundle";
        return (
          <div
            key={tier.id}
            className={cn(
              "service-card relative flex flex-col p-6 sm:p-7 lg:p-8",
              featured && "border-gold/70",
            )}
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1",
                featured ? "bg-gradient-to-r from-gold-deep via-gold-light to-gold-deep" : "bg-gold/35",
              )}
            />
            {featured && (
              <span className="absolute -top-3 right-4 border border-gold/50 bg-background px-3 py-1 font-sans text-[0.62rem] font-bold tracking-[0.14em] text-gold uppercase">
                Most complete
              </span>
            )}

            <div className="flex items-start justify-between gap-4">
              <p className="font-sans text-[0.68rem] font-bold tracking-[0.18em] text-gold uppercase">{tier.name}</p>
              <span className="font-brand text-3xl leading-none text-gold/55">0{index + 1}</span>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="gold-foil font-brand text-5xl leading-none">
                ${tier.price}
              </span>
              <span className="pb-1 font-sans text-[0.85rem] text-muted-foreground">
                one-time
              </span>
            </div>
            <p className="mt-4 font-sans text-[0.95rem] leading-relaxed text-ink">
              {tier.tagline}
            </p>

            <ul className="mt-5 flex-1 space-y-2.5">
              {tier.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-ink">
                  <span className="mt-0.5 font-hand text-xl leading-none text-redpen-text">
                    &#10003;
                  </span>
                  <span className="text-[0.9rem] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/order/$tier"
              params={{ tier: tier.id }}
              className={cn(stampClasses, "mt-7 w-full px-5 text-sm sm:text-sm")}
            >
              {tier.cta}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
