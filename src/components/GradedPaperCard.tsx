import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { GradeStamp } from "@/components/GradeStamp";
import { StampButton } from "@/components/StampButton";
import type { StoredRoast } from "@/lib/roast-session";
import { SECTION_LABEL } from "@/lib/roast-grounding";

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
      const file = new File([blob], `kcs-grade-${roast.grade}.png`, {
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
            <p className="mt-1 truncate font-sans text-base text-ink sm:text-lg">
              {roast.label}
            </p>
          </div>
          <GradeStamp grade={roast.grade} />
        </div>

        <div className="ruled-lines mt-7">
          <p className="font-sans text-[0.95rem] leading-[1.9rem] text-ink sm:text-base">
            {roast.roast}
          </p>
        </div>

        {roast.strengths.length > 0 && (
          <div className="mt-8 border-t border-dashed border-border pt-6">
            <p className="font-typewriter text-[0.68rem] tracking-[0.22em] text-ink-soft uppercase">
              What&rsquo;s working
            </p>
            <ul className="mt-3 space-y-3">
              {roast.strengths.map((s) => (
                <li key={s.point} className="font-sans text-[0.95rem] leading-relaxed text-ink">
                  <span className="text-gold">&#10003;</span> {s.point}
                  {s.quote && (
                    <span className="mt-1 block text-[0.85rem] text-muted-foreground">
                      From your résumé: &ldquo;{s.quote}&rdquo;
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 border-t border-dashed border-border pt-6">
          <p className="font-typewriter text-[0.68rem] tracking-[0.22em] text-ink-soft uppercase">
            Red-pen notes
          </p>
          <ul className="mt-3 space-y-4">
            {roast.notes.map((note) => (
              <li key={note.point}>
                <span className="font-hand text-2xl leading-tight text-redpen">{note.point}</span>
                <span className="mt-1 block font-sans text-[0.85rem] text-muted-foreground">
                  {note.quote
                    ? <>From your résumé: &ldquo;{note.quote}&rdquo;</>
                    : note.missing
                      ? <>We didn&rsquo;t find {SECTION_LABEL[note.missing]} in the text.</>
                      : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {roast.tip && (
          <div className="mt-8 border-l-2 border-redpen bg-paper-shade/40 px-5 py-4">
            <p className="font-typewriter text-[0.68rem] tracking-[0.22em] text-ink-soft uppercase">
              The one fix
            </p>
            <p className="mt-2 font-sans text-[0.95rem] leading-[1.7rem] text-ink">{roast.tip}</p>
            {roast.tipQuote && (
              <p className="mt-2 font-sans text-[0.85rem] text-muted-foreground">
                Applies to: &ldquo;{roast.tipQuote}&rdquo;
              </p>
            )}
          </div>
        )}

        <p className="mt-6 font-sans text-[0.75rem] text-muted-foreground">
          Graded from the text we read{roast.source === "pdf" ? " out of your PDF" : roast.source === "docx" ? " out of your DOCX" : " you pasted"}. Layout, fonts and design aren&rsquo;t judged.
        </p>

        <p className="mt-9 font-stamp text-[0.65rem] tracking-[0.3em] text-muted-foreground uppercase">
          Kay&rsquo;s Career Solutions &middot; resume grading
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <StampButton onClick={share} disabled={status === "working"}>
          {status === "working" ? "Stamping..." : "Share this roast"}
        </StampButton>
        <p className="font-sans text-[0.95rem] text-muted-foreground">
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
