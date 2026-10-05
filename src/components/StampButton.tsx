import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Shared polished gradient styling for primary actions. */
export const stampClasses = cn(
  "group relative inline-flex items-center justify-center gap-2",
  "min-h-12 rounded-md border border-primary bg-primary px-7 py-3.5",
  "font-sans text-sm font-bold tracking-[0.08em] text-primary-foreground uppercase",
  "transition-all duration-200",
  "shadow-[0_12px_30px_-14px_color-mix(in_oklab,var(--accent)_75%,transparent)]",
  "hover:-translate-y-0.5 hover:bg-primary/90",
  "active:translate-y-0",
  "disabled:pointer-events-none disabled:opacity-70",
  "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
);

function StampInk() {
  return null;
}

/** Primary action button. */
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
