import { createFileRoute, Link } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { RoastCards } from "@/components/RoastCards";
import { Upsell } from "@/components/Upsell";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Callback — Your Resume, Graded and Roasted" },
      {
        name: "description",
        content:
          "Upload your resume and get a letter grade, a roast, and the fix. Free grading, paid rewrites with ATS scoring.",
      },
      { property: "og:title", content: "Callback — Your resume just got graded." },
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
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="font-stamp text-xl tracking-[0.2em] text-ink uppercase"
          >
            Callback
          </Link>
          <div className="flex items-center gap-5">
            <Link
              to="/roast"
              className="font-typewriter text-sm text-ink underline decoration-redpen decoration-2 underline-offset-4 transition-colors hover:text-redpen"
            >
              Grade my resume
            </Link>
            <a
              href="#rewrite"
              className="font-typewriter text-sm text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-redpen"
            >
              Get the fix
            </a>
          </div>
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
