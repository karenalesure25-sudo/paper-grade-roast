import { createFileRoute } from "@tanstack/react-router";
import {
  CareerHeader,
  ClarityHero,
  CareerServices,
  CareerShowcase,
  CareerStatement,
} from "@/components/CareerHomepage";
import { FAQ } from "@/components/FAQ";
import { HowItWorks } from "@/components/HowItWorks";
import { Upsell } from "@/components/Upsell";
import { SiteFooter } from "@/components/SiteFooter";
import { PackageDetails } from "@/components/PackageDetails";

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
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://paper-grade-roast.lovable.app/og/kcs-share.jpg" },
      { name: "twitter:image", content: "https://paper-grade-roast.lovable.app/og/kcs-share.jpg" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="clarity-home relative min-h-screen">
      <CareerHeader />
      <main>
        <ClarityHero />
        <CareerServices />
        <CareerShowcase />
        <CareerStatement />
        <Upsell />
        <PackageDetails />
        <HowItWorks />
        <FAQ />
      </main>
      <SiteFooter />
    </div>
  );
}
