import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-subtle px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <BrandMark size="md" className="w-[190px]" />
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Honest résumé feedback and professional writing support built from your real experience.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 font-sans text-sm text-muted-foreground">
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
          <p className="font-sans text-xs text-muted-foreground md:col-span-2 md:text-right">
            &copy; {new Date().getFullYear()} Kay&rsquo;s Career Solutions &middot; Career clarity for what&rsquo;s next
          </p>
        </div>
    </footer>
  );
}
