import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export function SiteFooter() {
  return (
    <footer className="mt-8">
      {/* gold sweep sign-off, as on the flyer */}
      <div className="px-5 pb-10 text-center">
        <div className="gold-rule mx-auto max-w-3xl" />
        <p className="gold-foil mt-8 font-script text-[1.9rem] leading-tight sm:text-4xl">
          Let&rsquo;s Build Your Next Chapter
        </p>
      </div>

      <div className="border-t border-border px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <BrandMark size="sm" withTagline={false} />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-sans text-[0.95rem] text-muted-foreground">
            <Link to="/" hash="how" className="transition-colors hover:text-ink">
              How it works
            </Link>
            <Link to="/" hash="services" className="transition-colors hover:text-ink">
              Services
            </Link>
            <Link to="/roast" className="transition-colors hover:text-ink">
              Free roast
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
          </nav>
          <p className="font-sans text-[0.85rem] text-muted-foreground">
            &copy; {new Date().getFullYear()} Kay&rsquo;s Career Solutions
          </p>
        </div>
      </div>

      <div className="ribbon px-5 py-3 text-center">
        <p className="font-sans text-[0.65rem] font-semibold tracking-[0.34em] text-ink uppercase sm:text-xs">
          Confidence <span className="text-gold-light">&hearts;</span> Opportunity{" "}
          <span className="text-gold-light">&hearts;</span> Success
        </p>
      </div>
    </footer>
  );
}
