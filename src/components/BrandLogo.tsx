import { cn } from "@/lib/utils";

export function DocumentCheckIcon({ className }: { className?: string }) {
  return (
    <img src="/brand/kcs-emblem.svg" alt="Kay's Career Solutions" className={cn("block h-auto", className)} />
  );
}

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <img
      src="/brand/kcs-logo-original.jpeg"
      alt="Kay's Career Solutions — Career clarity for what's next"
      width="1536"
      height="512"
      decoding="async"
      className={cn(
        "block h-auto object-contain object-left",
        compact ? "w-[204px] sm:w-[238px]" : "w-full max-w-[560px]",
        className,
      )}
    />
  );
}
