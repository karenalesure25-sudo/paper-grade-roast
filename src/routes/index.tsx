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
          "Upload your resume and get a letter grade, a roast, and the fix. Free grading, paid rewrites with ATS scoring.",
      },
      { property: "og:title", content: "Kay’s Career Solutions — Land your dream job." },
      {
        property: "og:description",
        content: "Upload it. Get roasted. Get better. Free.",
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
        <HowItWorks />
        <RoastCards />
        <Upsell />
      </main>
      <SiteFooter />
    </div>
  );
}
