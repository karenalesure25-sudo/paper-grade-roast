import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Shared rubber-stamp styling for CTA buttons and links. */
export const stampClasses = cn(
  "group relative inline-flex items-center justify-center gap-2",
  "border-[3px] border-redpen bg-redpen px-8 py-4",
  "font-stamp text-base tracking-[0.16em] text-primary-foreground uppercase sm:text-lg",
  "-rotate-[1.5deg] transition-all duration-200",
  "shadow-[0_5px_0_0_var(--redpen-deep)]",
  "hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[0_7px_0_0_var(--redpen-deep)]",
  "active:translate-y-1 active:shadow-[0_1px_0_0_var(--redpen-deep)]",
  "disabled:pointer-events-none disabled:opacity-70",
  "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
);

function StampInk() {
  return (
    <span className="pointer-events-none absolute inset-[3px] border border-primary-foreground/40" />
  );
}

/** CTA styled as a red rubber stamp pressed onto the page. */
export function StampButton({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button {...props} className={cn(stampClasses, className)}>
      <StampInk />
      {children}
    </button>
  );
}

/** Same stamp treatment, as an internal route link. */
export function StampLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className={cn(stampClasses, className)}>
      <StampInk />
      {children}
    </Link>
  );
}
