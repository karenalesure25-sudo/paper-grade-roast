import { Link } from "@tanstack/react-router";
import { TIERS } from "@/lib/products";

/** Exact deliverables per package, how AI is used, and a clearly labeled synthetic example. */
const DELIVERABLES: Record<string, string[]> = {
  revamp: ["Rewritten résumé as an editable Word file", "Styled version of your chosen layout, ready to print to PDF"],
  scratch: ["New résumé written from your background answers as an editable Word file", "Styled version of your chosen layout, ready to print to PDF"],
  bundle: [
    "Rewritten résumé tailored to one job you send (Word + styled print-to-PDF)",
    "Matching cover letter for that job (Word + styled print-to-PDF)",
    "Estimated keyword match report on your order page",
  ],
};

export function PackageDetails() {
  return (
    <section id="what-you-get" className="clarity-shell py-16" aria-labelledby="what-you-get-title">
      <p className="clarity-eyebrow">What you get</p>
      <h2 id="what-you-get-title" className="font-display text-3xl text-ink sm:text-4xl">Exactly what each package delivers</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {TIERS.map((t) => (
          <article key={t.id} className="glass-surface min-w-0 rounded-lg p-6">
            <h3 className="font-sans text-lg font-semibold text-ink">{t.name} · ${t.price}</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              {DELIVERABLES[t.id]?.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Every package: one-time payment, your pick of 7 layouts before you pay, and files on a private order page for 30 days.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="glass-surface min-w-0 rounded-lg p-6">
          <h3 className="font-sans text-lg font-semibold text-ink">How AI is used</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your free roast and your paid documents are written by AI models using only the résumé, answers and job posting you provide.
            Before anything is released, automated checks compare every name, employer, date, school and number against your own text,
            and a separate AI check reviews the draft. If a fact can&rsquo;t be backed up, we ask you instead of guessing.
            AI can still make mistakes, so read your files before you send them.
          </p>
        </div>
        <figure className="glass-surface min-w-0 rounded-lg p-6" aria-label="Synthetic before and after example">
          <p className="font-typewriter text-[0.68rem] tracking-[0.22em] text-redpen-text uppercase">Synthetic example · not a real customer</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Before</p>
              <p className="mt-1 text-sm leading-6 text-ink">Responsible for scheduling trucks and helping new people.</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">After</p>
              <p className="mt-1 text-sm leading-6 text-ink">Coordinated inbound freight schedules for 12 regional carriers and trained 4 new hires on safety and inventory counts.</p>
            </div>
          </div>
          <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
            Made-up person and facts, shown only to illustrate style. The &ldquo;after&rdquo; uses only numbers that appeared in that sample&rsquo;s source details; results vary and no outcome is promised.
          </figcaption>
        </figure>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Questions about an order? See <Link to="/order-help" className="underline">order help</Link> and our <Link to="/terms" className="underline">terms</Link>.
      </p>
    </section>
  );
}
