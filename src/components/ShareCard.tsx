import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { GradeStamp } from "@/components/GradeStamp";
import { StampButton } from "@/components/StampButton";
import { shareCopy } from "@/lib/share-card";
import type { LetterGrade } from "@/lib/roast-grounding";

/**
 * Privacy-safe share image: grade, a fixed grade-based joke and the site link only.
 * Shown as a preview first; nothing is posted automatically.
 */
export function ShareCard({ grade }: { grade: LetterGrade }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "working" | "shared" | "error">("idle");
  const copy = shareCopy(grade);

  async function share() {
    const node = ref.current;
    if (!node) return;
    setStatus("working");
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0b1530" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `kcs-grade-${grade}.png`, { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: `My résumé got a ${grade}`, text: copy.text });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = file.name;
        a.click();
      }
      setStatus("shared");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return setStatus("idle");
      setStatus("error");
    }
  }

  return (
    <section aria-label="Share preview" className="space-y-4">
      <p className="font-typewriter text-[0.7rem] tracking-[0.22em] text-muted-foreground uppercase">
        Share preview · only this card is shared, never your résumé text
      </p>
      <div ref={ref} className="share-card mx-auto w-full max-w-[420px] rounded-lg border border-border bg-card p-7 shadow-paper-lift">
        <div className="flex items-start justify-between gap-4">
          <p className="font-typewriter text-[0.68rem] tracking-[0.22em] text-muted-foreground uppercase">My résumé got graded</p>
          <GradeStamp grade={grade} />
        </div>
        <p className="mt-5 font-sans text-lg leading-snug text-ink">{copy.quip}</p>
        <div className="mt-6 border-t border-dashed border-border pt-4">
          <p className="font-sans text-sm font-semibold text-ink">{copy.cta}</p>
          <p className="font-sans text-sm text-accent">{copy.displayUrl}</p>
        </div>
        <p className="mt-4 font-stamp text-[0.6rem] tracking-[0.3em] text-muted-foreground uppercase">Kay&rsquo;s Career Solutions</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <StampButton onClick={share} disabled={status === "working"}>
          {status === "working" ? "Preparing…" : "Share this card"}
        </StampButton>
        <p className="font-sans text-[0.95rem] text-muted-foreground" aria-live="polite">
          {status === "error" ? "Couldn't build the image. Try again." : status === "shared" ? "Image ready. You choose where to post it." : "Saves or shares the image above. Nothing posts automatically."}
        </p>
      </div>
    </section>
  );
}
