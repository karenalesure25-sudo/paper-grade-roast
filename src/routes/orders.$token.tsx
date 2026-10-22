import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StampButton } from "@/components/StampButton";
import { answerOrderQuestions, getOrderStatus, nudgeOrder, retryOrder, resumeOrderCheckout } from "@/lib/fulfillment.functions";
import { formatCustomerTime } from "@/lib/customer-time";
import { getTier } from "@/lib/products";
import { RevisionPanel } from "@/components/order/RevisionPanel";

export const Route = createFileRoute("/orders/$token")({
  head: () => ({
    meta: [
      { title: "Your order — Kay’s Career Solutions" },
      { name: "description", content: "Private order status, questions and downloads for your Kay’s Career Solutions package." },
      { property: "og:title", content: "Your order — Kay’s Career Solutions" },
      { property: "og:description", content: "Private order status and downloads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: OrderStatusPage,
});

type Status = Awaited<ReturnType<typeof getOrderStatus>>;

const COPY: Record<string, { title: string; body: string }> = {
  awaiting_payment: { title: "Payment not yet confirmed", body: "Your order is saved. Stripe hasn’t confirmed payment yet; a canceled or expired checkout does not unlock delivery." },
  queued: { title: "Payment confirmed", body: "Your package is next in line. Keep this private link to return to your order." },
  processing: { title: "Writing and fact-checking", body: "We’re writing your package from your own facts, then checking every detail before release. This can take a few minutes." },
  needs_information: { title: "We need a few details", body: "We won’t guess at your facts. Answer the questions below and writing resumes automatically." },
  ready: { title: "Your package is ready", body: "Every file passed our accuracy checks. Download them below." },
  failed: { title: "We couldn’t finish this one", body: "Your purchase isn’t used up." },
};

function OrderStatusPage() {
  const { token } = Route.useParams();
  const read = useServerFn(getOrderStatus);
  const nudge = useServerFn(nudgeOrder);
  const answer = useServerFn(answerOrderQuestions);
  const retry = useServerFn(retryOrder);
  const resumeCheckout = useServerFn(resumeOrderCheckout);
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nudging = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const s = await read({ data: { token } });
      setStatus(s);
      setLoadError(false);
      if (s && s.status === "queued" && !nudging.current) {
        nudging.current = true;
        // Claim-guarded on the server; the background sweep also processes it if this tab closes.
        nudge({ data: { token } }).then((n) => n && setStatus(n)).catch(() => undefined).finally(() => { nudging.current = false; });
      }
    } catch {
      setLoadError(true);
    }
  }, [read, nudge, token]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function submitAnswers(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 5) return setMsg("Add a little more detail.");
    setBusy(true);
    setMsg(null);
    try {
      const s = await answer({ data: { token, text } });
      if (s) setStatus(s);
      setText("");
      void refresh();
    } catch {
      setMsg("We couldn’t save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function doRetry() {
    setBusy(true);
    try {
      const s = await retry({ data: { token } });
      if (s) setStatus(s);
      void refresh();
    } catch {
      setMsg("We couldn’t restart your order. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reopenCheckout() {
    setBusy(true); setMsg(null);
    try {
      const result = await resumeCheckout({ data: { token } });
      if (result.already) await refresh();
      else window.location.assign(result.url);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Checkout couldn’t open. Try again.");
    } finally { setBusy(false); }
  }

  const c = status ? COPY[status.status] : undefined;
  const working = status && ["awaiting_payment", "queued", "processing"].includes(status.status);

  return (
    <div className="paper-texture min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <p className="eyebrow">Private order page</p>
        {status === undefined && !loadError && <p className="mt-6 text-muted-foreground" aria-live="polite">Loading your order…</p>}
        {loadError && status === undefined && (
          <p className="mt-6 text-redpen-text" role="alert">We couldn’t load your order right now. This page retries automatically.</p>
        )}
        {status === null && (
          <div className="mt-6">
            <h1 className="font-brand text-4xl text-ivory">Order not found</h1>
            <p className="mt-4 text-muted-foreground">This link is wrong or has expired.</p>
            <Link to="/" className="mt-6 inline-block text-gold underline underline-offset-4">Back to home</Link>
          </div>
        )}
        {status && c && (
          <>
            {status.testMode && (
              <p role="status" className="mt-4 inline-block rounded border border-gold/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
                Test order — no real charge, no emails sent
              </p>
            )}
            <h1 className="mt-4 font-brand text-4xl leading-tight text-ivory sm:text-5xl">
              {status.name ? `${c.title}, ${status.name}` : c.title}
            </h1>
            <div aria-live="polite">
              <p className="mt-4 text-lg text-muted-foreground">{c.body}</p>
              {working && (
                <div className="mt-6 h-1 w-full overflow-hidden bg-border" aria-hidden>
                  <div className="h-full w-1/3 animate-pulse bg-gold" />
                </div>
              )}
            </div>
            <p className="mt-6 border-l-2 border-gold pl-3 text-[0.9rem] text-muted-foreground">
              {status.emailed
                ? "We emailed you a link to this page. Keep it private."
                : status.emailActive
                  ? "Bookmark this page. We’ll also email you when your files are ready."
                  : "Bookmark this page. Email delivery isn’t switched on yet, so nothing is emailed — this private link is how you reach your files."}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">{getTier(status.tier)?.name} · ${getTier(status.tier)?.price} USD · One-time payment</p>
            {status.paidAt && <p className="mt-2 text-sm text-muted-foreground">Payment confirmed: {formatCustomerTime(status.paidAt)}</p>}
            {status.deliveryDeadline && <p className="mt-2 text-sm text-muted-foreground">Expected by: {formatCustomerTime(status.deliveryDeadline)} at the latest (48 hours, not counting Sundays) — typically sooner.</p>}
            {status.deliveredAt && <p className="mt-2 text-sm text-muted-foreground">Files first available: {formatCustomerTime(status.deliveredAt)}</p>}
            {status.expiresAt && <p className="mt-2 text-sm text-muted-foreground">Private link expires: {formatCustomerTime(status.expiresAt)}</p>}
            {status.status === "awaiting_payment" && <StampButton type="button" disabled={busy} onClick={reopenCheckout} className="mt-6">{busy ? "Opening checkout…" : "Reopen secure checkout"}</StampButton>}
            {msg && status.status !== "needs_information" && <p role="alert" className="mt-3 text-redpen-text">{msg}</p>}

            {status.status === "needs_information" && (
              <form onSubmit={submitAnswers} className="premium-panel mt-8 p-6">
                <ul className="list-disc space-y-2 pl-5 text-ink">
                  {status.questions.map((q) => <li key={q}>{q}</li>)}
                </ul>
                <label htmlFor="answers" className="mt-5 block text-sm text-muted-foreground">Your answers</label>
                <textarea
                  id="answers"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={6000}
                  rows={6}
                  className="mt-2 w-full border border-border bg-paper-shade p-3 text-[16px] text-ivory outline-none focus:border-gold"
                />
                <StampButton type="submit" disabled={busy} className="mt-4">{busy ? "Saving…" : "Send answers"}</StampButton>
                {msg && <p role="alert" className="mt-3 text-redpen-text">{msg}</p>}
              </form>
            )}

            {status.status === "failed" && (
              <div className="premium-panel mt-8 p-6">
                {status.failureReason && <p className="text-ink">{status.failureReason}</p>}
                {status.canRetry ? (
                  <StampButton type="button" onClick={doRetry} disabled={busy} className="mt-4">{busy ? "Restarting…" : "Try again"}</StampButton>
                ) : (
                  <p className="mt-3 text-muted-foreground">Automatic retries are used up. Please contact Kay’s Career Solutions with this page’s link.</p>
                )}
              </div>
            )}

            {status.status === "ready" && (
              <div className="mt-8 space-y-6">
                {status.revisions.some((r) => r.status === "ready") && <h2 className="font-stamp text-xl text-ink">Original delivery (version 1)</h2>}
                <ul className="premium-panel divide-y divide-border p-2">
                  {status.files.map((f) => (
                    <li key={f.kind}>
                      <a href={f.href} className="flex min-h-12 items-center justify-between px-4 py-3 text-ink hover:text-gold">
                        <span>{f.label}</span><span aria-hidden>↓</span>
                      </a>
                    </li>
                  ))}
                </ul>
                {status.keywordReport && (
                  <div className="premium-panel p-6">
                    <h2 className="font-stamp text-xl text-ink">Keyword comparison</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Estimated coverage: {status.keywordReport.estimatedCoverage}%. {status.keywordReport.note}
                    </p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead><tr className="text-muted-foreground"><th className="py-2 pr-3">Posting keyword</th><th className="py-2 pr-3">In your background</th><th className="py-2">In résumé</th></tr></thead>
                        <tbody>
                          {status.keywordReport.rows.map((r) => (
                            <tr key={r.keyword} className="border-t border-border text-ink">
                              <td className="py-2 pr-3">{r.keyword}</td><td className="py-2 pr-3">{r.inSource ? "Yes" : "No"}</td><td className="py-2">{r.inResume ? "Yes" : "No"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <RevisionPanel token={token} status={status} onStatus={setStatus} />
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
