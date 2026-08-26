import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { GradeStamp } from "@/components/GradeStamp";
import { StampButton } from "@/components/StampButton";
import type { StoredRoast } from "@/lib/roast-session";

/** The graded-paper result card, plus a share-as-image action. */
export function GradedPaperCard({ roast }: { roast: StoredRoast }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "working" | "shared" | "error">("idle");

  async function share() {
    const node = cardRef.current;
    if (!node) return;
    setStatus("working");
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#faf9f6",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `callback-grade-${roast.grade}.png`, {
        type: "image/png",
      });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] }) &&
        navigator.share
      ) {
        await navigator.share({
          files: [file],
          title: `My resume got a ${roast.grade}`,
        });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = file.name;
        link.click();
      }
      setStatus("shared");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      console.error(error);
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div
        ref={cardRef}
        className="torn-edge relative bg-card px-6 pt-8 pb-10 shadow-paper-lift sm:px-10"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-typewriter text-[0.7rem] tracking-[0.22em] text-muted-foreground uppercase">
              Graded submission
            </p>
            <p className="mt-1 truncate font-typewriter text-base text-ink sm:text-lg">
              {roast.label}
            </p>
          </div>
          <GradeStamp grade={roast.grade} />
        </div>

        <div className="ruled-lines mt-7">
          <p className="font-typewriter text-[0.95rem] leading-[1.9rem] text-ink sm:text-base">
            {roast.roast}
          </p>
        </div>

        <ul className="mt-8 space-y-4 border-t border-dashed border-border pt-6">
          {roast.notes.map((note) => (
            <li key={note} className="flex gap-3">
              <span aria-hidden className="font-hand text-2xl leading-none text-redpen">
                &#8250;
              </span>
              <span className="font-hand text-2xl leading-tight text-redpen">{note}</span>
            </li>
          ))}
        </ul>

        {roast.tip && (
          <div className="mt-8 border-l-2 border-redpen bg-paper-shade/40 px-5 py-4">
            <p className="font-typewriter text-[0.68rem] tracking-[0.22em] text-redpen uppercase">
              The one fix
            </p>
            <p className="mt-2 font-typewriter text-[0.95rem] leading-[1.7rem] text-ink">
              {roast.tip}
            </p>
          </div>
        )}

        <p className="mt-9 font-stamp text-[0.65rem] tracking-[0.3em] text-muted-foreground uppercase">
          Callback &middot; resume grading
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <StampButton onClick={share} disabled={status === "working"}>
          {status === "working" ? "Stamping..." : "Share this roast"}
        </StampButton>
        <p className="font-typewriter text-sm text-muted-foreground">
          {status === "error"
            ? "Couldn't build the image. Try again."
            : status === "shared"
              ? "Image ready \u2014 post it and tag the roast."
              : "Saves the card as an image for Instagram or TikTok."}
        </p>
      </div>
    </div>
  );
}
