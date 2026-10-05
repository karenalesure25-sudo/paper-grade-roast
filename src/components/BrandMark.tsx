import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

/** Responsive ribbon-emblem wordmark for Kay's Career Solutions. */
export function BrandMark({
  size = "md",
  withTagline = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
  className?: string;
}) {
  return <BrandLogo compact={!withTagline || size === "sm"} {...(className ? { className } : {})} />;
}

/** Wordmark that links home — used in page headers. */
export function BrandLink({
  size = "md",
  withTagline = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
  className?: string;
}) {
  return (
    <Link to="/" className={cn("inline-block", className)} aria-label="Kay's Career Solutions home">
      <BrandMark size={size} withTagline={withTagline} />
    </Link>
  );
}
