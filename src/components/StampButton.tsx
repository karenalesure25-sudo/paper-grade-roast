import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** CTA styled as a red rubber stamp pressed onto the page. */
export function StampButton({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...props}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2",
        "border-[3px] border-redpen bg-redpen px-8 py-4",
        "font-stamp text-base tracking-[0.16em] text-primary-foreground uppercase sm:text-lg",
        "-rotate-[1.5deg] transition-all duration-200",
        "shadow-[0_5px_0_0_var(--redpen-deep)]",
        "hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[0_7px_0_0_var(--redpen-deep)]",
        "active:translate-y-1 active:shadow-[0_1px_0_0_var(--redpen-deep)]",
        "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-[3px] border border-primary-foreground/40" />
      {children}
    </button>
  );
}
