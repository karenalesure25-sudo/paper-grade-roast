import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Gold-script wordmark for Kay's Career Solutions, framed like the
 * flyer nameplate: crown flourish, script name, spaced-out tagline.
 */
export function BrandMark({
  size = "md",
  withTagline = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
  className?: string;
}) {
  const nameSize =
    size === "lg"
      ? "text-[2.4rem] sm:text-6xl"
      : size === "sm"
        ? "text-2xl"
        : "text-[1.9rem] sm:text-4xl";

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <span aria-hidden className="gold-foil font-display text-xs leading-none">
        &#9819;
      </span>
      <span
        className={cn("gold-foil font-script leading-[1.15]", nameSize)}
        // script glyphs need a touch of room for descenders
        style={{ paddingBottom: "0.12em" }}
      >
        Kay&rsquo;s Career Solutions
      </span>
      {withTagline && (
        <span className="mt-1 font-sans text-[0.6rem] font-semibold tracking-[0.34em] text-gold/85 uppercase sm:text-[0.7rem]">
          Polish &middot; Optimize &middot; Elevate
        </span>
      )}
    </div>
  );
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
