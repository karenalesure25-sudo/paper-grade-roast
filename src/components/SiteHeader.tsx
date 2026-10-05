import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const links = [
  { label: "Free Roast", href: "/roast" },
  { label: "Services", href: "/#services" },
  { label: "How It Works", href: "/#how" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header sticky top-0 z-50 border-b border-border/80 bg-background/88 px-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto grid min-h-20 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:min-h-24 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-8">
        <Link to="/" aria-label="Kay's Career Solutions home" className="min-w-0 justify-self-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo compact />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a key={link.label} href={link.href} className="nav-link">{link.label}</a>
          ))}
        </nav>
        <Link to="/roast" className="premium-button hidden min-h-11 px-5 text-xs lg:inline-flex">Get My Free Roast</Link>
        <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-ivory transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile navigation" className="mx-auto grid max-w-7xl gap-1 border-t border-border py-3 lg:hidden">
          {links.map((link) => (
            <a key={link.label} href={link.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center px-2 font-sans text-sm font-semibold text-ivory hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{link.label}</a>
          ))}
          <Link to="/roast" onClick={() => setOpen(false)} className="premium-button mt-2 min-h-12 w-full">Get My Free Roast</Link>
        </nav>
      )}
    </header>
  );
}