import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { ResumeTemplate } from "@/components/ResumeTemplate";
import { StampButton } from "@/components/StampButton";
import type { StoredOrder } from "@/lib/order-session";

/** The finished, unlocked résumé plus download/print actions. */
export function ResumeDeliverable({
  order,
  photo = null,
}: {
  order: StoredOrder;
  photo?: string | null;
}) {

  const sheetRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function download() {
    const node = sheetRef.current;
    if (!node) return;
    setStatus("working");
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `kcs-resume-${order.template}.png`;
      link.click();
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div ref={sheetRef} className="mx-auto max-w-[720px] shadow-paper-lift">
        <ResumeTemplate
          template={order.template}
          data={order.result.resume}
          photo={photo}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <StampButton type="button" onClick={download} disabled={status === "working"}>
          {status === "working" ? "Exporting..." : "Download My Resume"}
        </StampButton>
        <button
          type="button"
          onClick={() => window.print()}
          className="font-sans text-[0.95rem] text-ink underline decoration-ink-soft decoration-2 underline-offset-4 transition-colors hover:text-ink"
        >
          Print / save as PDF
        </button>
      </div>

      {status === "error" && (
        <p className="font-hand text-2xl text-redpen-text">
          The export choked. Try the print option instead.
        </p>
      )}
    </div>
  );
}
