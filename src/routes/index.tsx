import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { FAQ } from "@/components/FAQ";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { RoastCards } from "@/components/RoastCards";
import { Upsell } from "@/components/Upsell";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kay's Career Solutions — Career clarity for what's next" },
      {
        name: "description",
        content:
          "Get a free resume roast with notes checked against your own résumé, plus Kay’s $40, $50 and $60 résumé services.",
      },
      { property: "og:title", content: "Free Resume Roast — Kay’s Career Solutions" },
      {
        property: "og:description",
        content: "A free letter grade and red-pen notes checked against your résumé.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary"
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="paper-texture relative min-h-screen">
      <SiteHeader />
      <main>
        <Hero />
        <section aria-label="Our approach" className="ribbon border-y border-accent/25 px-4 py-5 sm:px-6">
          <p className="mx-auto max-w-6xl text-center font-sans text-xs font-semibold tracking-[0.18em] text-ivory uppercase sm:text-sm">Polish your story <span className="text-accent">•</span> Optimize your résumé <span className="text-accent">•</span> Elevate your next move</p>
        </section>
        <Upsell />
        <RoastCards />
        <HowItWorks />
        <FAQ />
      </main>
      <SiteFooter />
    </div>
  );
}
