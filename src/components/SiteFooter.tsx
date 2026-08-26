export function SiteFooter() {
  return (
    <footer className="border-t border-border px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="font-stamp text-lg tracking-widest text-ink uppercase">
          Callback
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-sans text-[0.95rem] text-muted-foreground">
          <a href="#how" className="transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#rewrite" className="transition-colors hover:text-ink">
            Rewrite
          </a>
          <a href="#" className="transition-colors hover:text-ink">
            Privacy
          </a>
        </nav>
        <p className="font-sans text-[0.85rem] text-muted-foreground">
          &copy; {new Date().getFullYear()} Callback
        </p>
      </div>
    </footer>
  );
}
