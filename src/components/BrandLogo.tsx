import { cn } from "@/lib/utils";

const metallicLogo = "/brand/kays-career-solutions-metallic.webp";

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
    <img
      src={metallicLogo}
      alt="Kay's Career Solutions — Polish, Optimize, Elevate"
      width="2172"
      height="724"
      decoding="async"
      className={cn(
        "block h-auto object-contain object-left",
        compact ? "w-[180px] sm:w-[220px]" : "w-full max-w-[560px]",
        className,
      )}
    />
  );
}