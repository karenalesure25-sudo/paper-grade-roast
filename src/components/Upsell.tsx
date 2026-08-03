import { StampLink } from "@/components/StampButton";

const included = [
  "Every bullet rewritten, in your voice",
  "ATS score with the exact keywords you're missing",
  "Recruiter-eye summary rebuilt from scratch",
  "Two revision passes, same résumé",
  "Formatted export, no broken columns",
];

export function Upsell() {
  return (
    <section id="rewrite" className="px-5 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
        <div>
          <h2 className="font-stamp text-[2rem] leading-[1.15] text-ink sm:text-5xl">
            The roast was free.
            <br />
            <span className="text-redpen">The fix isn&apos;t.</span>
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Knowing your résumé is a C- doesn&apos;t get you an interview. The
            rewrite does: real edits by line, scored against the ATS filters that
            were throwing you out before a human ever opened the file.
          </p>
          <ul className="mt-8 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex gap-3 text-ink">
                <span className="mt-0.5 font-hand text-2xl leading-none text-redpen">
                  &#10003;
                </span>
                <span className="text-[0.975rem] leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative bg-card p-8 shadow-paper-lift sm:p-10 lg:rotate-[0.8deg]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-redpen" />
          <p className="font-typewriter text-xs tracking-[0.28em] text-muted-foreground uppercase">
            Full rewrite
          </p>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-stamp text-6xl leading-none text-ink">$29</span>
            <span className="pb-1.5 font-typewriter text-sm text-muted-foreground">
              one résumé, one price
            </span>
          </div>
          <p className="mt-4 font-typewriter text-sm text-ink">
            <span className="marker">Cheaper than one missed interview.</span>
          </p>

          <StampLink to="/roast" className="mt-8 w-full">
            Start My Rewrite
          </StampLink>

          <p className="mt-5 text-center font-typewriter text-xs text-muted-foreground">
            48-hour turnaround &middot; refund if your score doesn&apos;t move
          </p>
        </div>
      </div>
    </section>
  );
}
