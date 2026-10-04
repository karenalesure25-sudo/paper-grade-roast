import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const links = [
  { label: "Free Roast", to: "/roast" as const },
  { label: "Services", to: "/" as const, hash: "services" },
  { label: "How It Works", to: "/" as const, hash: "how" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header sticky top-0 z-50 border-b border-border/70 bg-background/92 px-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto grid min-h-20 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Link to="/" aria-label="Kay's Career Solutions home" className="min-w-0 justify-self-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <Link key={link.label} to={link.to} hash={link.hash} className="nav-link">{link.label}</Link>
          ))}
        </nav>
        <Link to="/roast" className="premium-button hidden min-h-11 px-5 text-xs lg:inline-flex">Get My Free Roast</Link>
        <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-11 shrink-0 place-items-center border border-border bg-card text-ivory transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile navigation" className="mx-auto grid max-w-7xl gap-1 border-t border-border py-3 lg:hidden">
          {links.map((link) => (
            <Link key={link.label} to={link.to} hash={link.hash} onClick={() => setOpen(false)} className="flex min-h-12 items-center px-2 font-sans text-sm font-semibold text-ivory hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{link.label}</Link>
          ))}
          <Link to="/roast" onClick={() => setOpen(false)} className="premium-button mt-2 min-h-12 w-full">Get My Free Roast</Link>
        </nav>
      )}
    </header>
  );
}