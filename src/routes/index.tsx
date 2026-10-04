import { createFileRoute } from "@tanstack/react-router";
import { BrandLink } from "@/components/BrandMark";
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
      <header className="px-5 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-center">
          <BrandLink size="md" />
        </div>
      </header>
      <main>
        <Hero />
        <Upsell />
        <HowItWorks />
        <RoastCards />
      </main>
      <SiteFooter />
    </div>
  );
}
