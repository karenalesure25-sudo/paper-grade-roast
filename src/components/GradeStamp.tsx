import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Reveals a rubber-stamp grade with a slam-down animation once scrolled into view. */
export function GradeStamp({
  grade,
  className,
  delay = 0,
}: {
  grade: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          window.setTimeout(() => setStamped(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={cn("select-none", className)}>
      <div
        className={cn(
          "grid size-20 place-items-center rounded-full border-[3px] border-redpen text-redpen opacity-0 sm:size-24",
          "shadow-[inset_0_0_0_2px_var(--paper),0_0_0_1px_color-mix(in_oklab,var(--redpen)_35%,transparent)]",
          stamped && "animate-stamp-in",
        )}
      >
        <span className="font-stamp text-4xl leading-none sm:text-5xl">{grade}</span>
      </div>
    </div>
  );
}
