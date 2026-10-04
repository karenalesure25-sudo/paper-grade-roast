import { cn } from "@/lib/utils";

export function DocumentCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 76 86" role="img" aria-label="Résumé with check" className={className}>
      <defs>
        <linearGradient id="kcs-gold-icon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gold-light)" />
          <stop offset="0.46" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--gold-deep)" />
        </linearGradient>
      </defs>
      <path d="M12 3h36l16 16v52a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8V11a8 8 0 0 1 8-8Z" fill="url(#kcs-gold-icon)" />
      <path d="M48 3v16h16" fill="none" stroke="var(--board)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M17 29h25M17 40h30M17 51h22" fill="none" stroke="var(--ivory)" strokeWidth="5" strokeLinecap="round" />
      <path d="m24 59 12 13 32-39" fill="none" stroke="var(--redpen)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m24 59 12 13 32-39" fill="none" stroke="var(--redpen-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
    </svg>
  );
}

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("brand-logo flex min-w-0 items-center", compact ? "gap-2.5" : "gap-3 sm:gap-4", className)}>
      <DocumentCheckIcon className={cn("shrink-0", compact ? "h-10 w-9" : "h-12 w-11 sm:h-14 sm:w-12")} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={cn("gold-foil font-brand leading-none", compact ? "text-[1.55rem]" : "text-[1.85rem] sm:text-[2.2rem]")}>Kay&rsquo;s</span>
          <span className={cn("font-brand-sub leading-none text-ivory uppercase", compact ? "text-[0.54rem]" : "text-[0.62rem] sm:text-[0.72rem]")}>Career Solutions</span>
        </div>
        {!compact && (
          <div className="mt-1.5 flex items-center gap-2" aria-label="Polish, Optimize, Elevate">
            <span className="h-px flex-1 bg-gold/45" />
            <span className="truncate font-sans text-[0.48rem] font-semibold tracking-[0.22em] text-ivory-muted uppercase sm:text-[0.56rem]">Polish <b className="text-gold">•</b> Optimize <b className="text-gold">•</b> Elevate</span>
          </div>
        )}
      </div>
    </div>
  );
}