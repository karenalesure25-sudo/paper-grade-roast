import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TIERS } from "@/lib/products";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Kay’s Career Solutions" },
      { name: "description", content: "Prices, payment, AI-written deliverables, and order link terms for Kay’s Career Solutions résumé packages." },
      { property: "og:title", content: "Terms — Kay’s Career Solutions" },
      { property: "og:description", content: "How our résumé packages, payment and private order links work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-ink uppercase sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-3 font-sans text-[1rem] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="paper-texture relative min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl text-ink uppercase sm:text-5xl">Terms</h1>
        <Section title="Packages and prices">
          <ul className="list-disc space-y-1 pl-5">
            {TIERS.map((t) => <li key={t.id}>{t.name}: ${t.price} USD, one-time payment.</li>)}
          </ul>
          <p>Payment is taken through Stripe&rsquo;s secure checkout. Work starts only after Stripe confirms payment.</p>
        </Section>
        <Section title="No refunds">
          <p>All sales are final. We do not offer refunds.</p>
          <p>If our accuracy checks can&rsquo;t approve your package, your purchase isn&rsquo;t used up: you can answer follow-up questions or retry from your order page.</p>
        </Section>
        <Section title="AI-written documents">
          <p>Documents are written by AI models from the information you provide, then checked automatically against your own text. We don&rsquo;t invent jobs, schools, dates or numbers. Review your files before using them; you are responsible for what you submit to employers.</p>
          <p>We don&rsquo;t promise interviews, job offers or any specific result. Keyword reports are estimates, not a score from any real applicant tracking system.</p>
        </Section>
        <Section title="Private order links">
          <p>Your order page link is private. Anyone with it can view your order, so don&rsquo;t share it. Files stay available for 30 days, then are deleted. Unpaid orders are removed after 3 days.</p>
        </Section>
        <Section title="Free résumé roast">
          <p>The roast is an AI-written, for-fun review of your writing only. It doesn&rsquo;t judge layout and isn&rsquo;t career advice.</p>
        </Section>
        <p className="mt-10 text-sm text-muted-foreground">See also our <Link to="/privacy" className="underline">privacy notice</Link> and <Link to="/order-help" className="underline">order help</Link>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
