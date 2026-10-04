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
      { title: "Kay's Career Solutions — Polish. Optimize. Elevate." },
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
        <section aria-label="Our approach" className="ribbon border-y border-redpen/60 px-4 py-5 sm:px-6">
          <p className="mx-auto max-w-6xl text-center font-brand text-lg font-semibold text-ivory sm:text-2xl">Polish your story <span className="text-gold-light">•</span> Optimize your résumé <span className="text-gold-light">•</span> Elevate your next move</p>
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
