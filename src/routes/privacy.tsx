import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Kay’s Career Solutions" },
      { name: "description", content: "How Kay’s Career Solutions handles your résumé for the free roast and paid service intakes." },
      { property: "og:title", content: "Privacy — Kay’s Career Solutions" },
      { property: "og:description", content: "What we process, what we store, and for how long." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-ink uppercase sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-3 font-sans text-[1rem] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="paper-texture relative min-h-screen">
      <SiteHeader />
      <main className="px-4 py-12 sm:px-6 sm:py-16">
        <article className="premium-panel mx-auto max-w-3xl p-6 sm:p-10">
          <p className="eyebrow">Plain language policy</p>
          <h1 className="mt-4 font-brand text-4xl leading-tight text-ivory sm:text-6xl">Privacy</h1>
          <p className="mt-4 font-sans text-[0.9rem] text-muted-foreground">
            A plain-language summary of how this site handles your information.
          </p>

          <Section title="Free resume roast">
            <p>
              When you request a roast, the text of your résumé (read from your PDF or DOCX, or what you paste)
              is sent to an outside AI service to be graded. We don&rsquo;t save your résumé or your roast in our
              database.
            </p>
            <p>
              Your results are kept in your own browser for this tab only, and they disappear when you close the
              tab or press &ldquo;Clear my results&rdquo;. We don&rsquo;t make any promises about how long the AI
              provider itself keeps the data.
            </p>
          </Section>

          <Section title="Paid service intake forms">
            <p>
              When you submit an intake form, we store your answers (name, email, phone, job details, background)
              and any files you upload so Kay can work on your order. This information is private and can only be
              accessed by the site&rsquo;s server. There is no automatic deletion schedule for intakes yet.
            </p>
            <p>Payments are handled by Stripe. Card details go directly to Stripe and never reach this site; we keep a record of the paid checkout (service, amount and email) to confirm your order.</p>
          </Section>

          <Section title="Finished résumés and download links">
            <p>
              When an order is completed, the finished résumé (and cover letter for the $60 package) is stored so
              you can download it. Download links are set to expire 7 days after the order is created, and a
              scheduled clean-up job is set up to remove expired orders.
            </p>
          </Section>

          <Section title="Email">
            <p>Order emails aren&rsquo;t switched on yet. We aren&rsquo;t sending emails from this site right now.</p>
          </Section>

          <Section title="Questions">
            <p>
              A verified business contact address has not been added to this site yet. It must be added before customers can request access to or removal of stored information through the site.
            </p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
