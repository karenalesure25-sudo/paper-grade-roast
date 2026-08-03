import { Link } from "@tanstack/react-router";
import { TIERS } from "@/lib/products";
import { stampClasses } from "@/components/StampButton";
import { cn } from "@/lib/utils";

/** The three paid tiers, each linking to its own flow. */
export function PricingTiers() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {TIERS.map((tier, index) => {
        const featured = tier.id === "bundle";
        return (
          <div
            key={tier.id}
            className={cn(
              "relative flex flex-col bg-card p-7 shadow-paper-lift",
              index === 0 && "lg:-rotate-[0.7deg]",
              index === 2 && "lg:rotate-[0.7deg]",
            )}
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1.5",
                featured ? "bg-redpen" : "bg-ink",
              )}
            />
            {featured && (
              <span className="absolute -top-3 right-5 bg-redpen px-2 py-1 font-stamp text-[0.6rem] tracking-[0.18em] text-primary-foreground uppercase">
                Best value
              </span>
            )}

            <p className="font-typewriter text-xs tracking-[0.24em] text-muted-foreground uppercase">
              {tier.name}
            </p>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-stamp text-5xl leading-none text-ink">
                ${tier.price}
              </span>
              <span className="pb-1 font-typewriter text-xs text-muted-foreground">
                one-time
              </span>
            </div>
            <p className="mt-4 font-typewriter text-sm leading-relaxed text-ink">
              {tier.tagline}
            </p>

            <ul className="mt-5 flex-1 space-y-2.5">
              {tier.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-ink">
                  <span className="mt-0.5 font-hand text-xl leading-none text-redpen">
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
              <span className="pointer-events-none absolute inset-[3px] border border-primary-foreground/40" />
              {tier.cta}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
