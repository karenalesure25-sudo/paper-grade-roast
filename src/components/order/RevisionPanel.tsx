import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { StampButton } from "@/components/StampButton";
import { answerRevisionQuestion, nudgeOrderRevision, requestOrderRevision, retryOrderRevision, type getOrderStatus } from "@/lib/fulfillment.functions";
import { formatCustomerTime } from "@/lib/customer-time";

type Status = NonNullable<Awaited<ReturnType<typeof getOrderStatus>>>;
type Rev = Status["revisions"][number];

const REV_STATUS: Record<Rev["status"], string> = {
  queued: "Received — in line",
  processing: "Revising and fact-checking",
  needs_information: "We need one detail",
  ready: "Revised files ready",
  failed: "Couldn’t finish",
  rejected: "Not accepted",
};

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`;
}

export function RevisionPanel({ token, status, onStatus }: { token: string; status: Status; onStatus: (s: Status) => void }) {
  const request = useServerFn(requestOrderRevision);
  const answer = useServerFn(answerRevisionQuestion);
  const retry = useServerFn(retryOrderRevision);
  const nudge = useServerFn(nudgeOrderRevision);
  const [kind, setKind] = useState<"minor" | "correction">(status.minorRevision === "available" ? "minor" : "correction");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // One key per draft: a double-click or network retry submits the same request once.
  const key = useRef(newKey());
  const nudged = useRef<string | null>(null);

  const open = status.revisions.find((r) => ["queued", "processing", "needs_information"].includes(r.status));
  useEffect(() => {
    if (open?.status === "queued" && nudged.current !== open.id) {
      nudged.current = open.id;
      nudge({ data: { token, id: open.id } }).then((s) => s && onStatus(s)).catch(() => undefined);
    }
  }, [open?.id, open?.status, nudge, token, onStatus]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (t.length < 10) return setMsg({ ok: false, text: "Describe the change in at least 10 characters." });
    setBusy(true); setMsg(null);
    try {
      const r = await request({ data: { token, kind, text: t, idem: key.current } });
      if (r.status) onStatus(r.status);
      setMsg({ ok: r.ok, text: r.ok ? "Request received. Nothing is used up unless your revised files pass our checks." : r.message });
      if (r.ok) { setText(""); key.current = newKey(); }
    } catch {
      setMsg({ ok: false, text: "We couldn’t submit that right now. Nothing was used up — please try again." });
    } finally { setBusy(false); }
  }

  async function sendReply(id: string) {
    if (reply.trim().length < 10) return setMsg({ ok: false, text: "Add a little more detail (10+ characters)." });
    setBusy(true); setMsg(null);
    try { const s = await answer({ data: { token, id, text: reply.trim() } }); if (s) onStatus(s); setReply(""); }
    catch { setMsg({ ok: false, text: "We couldn’t save that. Try again." }); }
    finally { setBusy(false); }
  }

  async function doRetry(id: string) {
    setBusy(true); setMsg(null);
    try { const s = await retry({ data: { token, id } }); if (s) onStatus(s); }
    catch { setMsg({ ok: false, text: "We couldn’t restart that request. Try again." }); }
    finally { setBusy(false); }
  }

  const canMinor = status.minorRevision === "available";
  const corrections = status.revisions.filter((r) => r.kind === "correction").length;
  const canCorrect = corrections < 3 && status.revisions.length < 6;
  const canSubmit = !open && (canMinor || canCorrect);

  return (
    <section className="premium-panel p-6" aria-labelledby="revisions-heading">
      <h2 id="revisions-heading" className="font-stamp text-xl text-ink">Revisions</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your package includes one complimentary minor revision: wording, corrections or formatting within your selected template.
        It doesn’t cover a full rewrite, a different target job, substantial new experience or a template switch.
        Revisions are written with AI from the facts you already gave us and pass the same accuracy checks.
        Expect revised files within 48 hours of a complete request, not counting Sundays (Central Time) — typically sooner.
      </p>
      {status.deliveredAt && (
        <p className="mt-3 text-sm text-muted-foreground">
          Files first available: {formatCustomerTime(status.deliveredAt)}
          {status.minorWindowEnd && <> · Minor revision requests close: {formatCustomerTime(status.minorWindowEnd)}</>}
        </p>
      )}
      <p className="mt-2 text-sm text-ink">
        {status.minorRevision === "available" && "Your included minor revision is available."}
        {status.minorRevision === "pending" && "A request is in progress."}
        {status.minorRevision === "used" && "Your included minor revision has been delivered."}
        {status.minorRevision === "closed" && "The 7-day window for your included minor revision has closed."}
      </p>

      {status.revisions.length > 0 && (
        <ol className="mt-5 space-y-4">
          {status.revisions.map((r) => (
            <li key={r.id} className="border border-border p-4">
              <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
                <p className="min-w-0 font-medium text-ink">
                  {r.kind === "minor" ? "Included minor revision" : "Correction of an error we introduced"} — {REV_STATUS[r.status]}
                </p>
                {r.version && <span className="text-sm text-gold">Version {r.version}</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Requested {formatCustomerTime(r.requestedAt)}
                {["queued", "processing"].includes(r.status) && <> · Allow until {formatCustomerTime(r.deadlineAt)}</>}
                {r.completedAt && <> · Completed {formatCustomerTime(r.completedAt)}</>}
              </p>
              {r.reason && <p className="mt-2 text-sm text-ink">{r.reason}</p>}
              {r.canRetry && <StampButton type="button" disabled={busy} onClick={() => doRetry(r.id)} className="mt-3">{busy ? "Restarting…" : "Try again"}</StampButton>}
              {r.status === "needs_information" && (
                <div className="mt-3">
                  {r.question && <p className="text-sm text-ink">{r.question}</p>}
                  <label htmlFor={`reply-${r.id}`} className="mt-3 block text-sm text-muted-foreground">Your answer</label>
                  <textarea id={`reply-${r.id}`} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1500} rows={3}
                    className="mt-1 w-full border border-border bg-paper-shade p-3 text-[16px] text-ivory outline-none focus:border-gold" />
                  <StampButton type="button" disabled={busy} onClick={() => sendReply(r.id)} className="mt-3">{busy ? "Sending…" : "Send answer"}</StampButton>
                </div>
              )}
              {r.files.length > 0 && (
                <ul className="mt-3 divide-y divide-border border border-border">
                  {r.files.map((f) => (
                    <li key={f.kind}>
                      <a href={f.href} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-ink hover:text-gold">
                        <span className="min-w-0">Revised v{r.version} · {f.label}</span><span aria-hidden>↓</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      {canSubmit && (
        <form onSubmit={submit} className="mt-6">
          <fieldset>
            <legend className="text-sm text-muted-foreground">What kind of request?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className={`flex min-h-11 items-start gap-2 border p-3 text-sm ${canMinor ? "border-border text-ink" : "border-border text-muted-foreground opacity-60"}`}>
                <input type="radio" name="kind" value="minor" checked={kind === "minor"} disabled={!canMinor} onChange={() => setKind("minor")} className="mt-1" />
                <span>Included minor revision</span>
              </label>
              <label className={`flex min-h-11 items-start gap-2 border p-3 text-sm ${canCorrect ? "border-border text-ink" : "border-border text-muted-foreground opacity-60"}`}>
                <input type="radio" name="kind" value="correction" checked={kind === "correction"} disabled={!canCorrect} onChange={() => setKind("correction")} className="mt-1" />
                <span>Fix an error we introduced (free; quote the wrong text and where the right detail appears in what you gave us)</span>
              </label>
            </div>
          </fieldset>
          <label htmlFor="revision-text" className="mt-4 block text-sm text-muted-foreground">Describe the change</label>
          <textarea id="revision-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={5}
            className="mt-1 w-full border border-border bg-paper-shade p-3 text-[16px] text-ivory outline-none focus:border-gold" />
          <p className="mt-1 text-xs text-muted-foreground">{text.length}/1500 · Changes must use facts you already gave us; new jobs, dates or numbers can’t be added.</p>
          <StampButton type="submit" disabled={busy} className="mt-4">{busy ? "Submitting…" : "Submit request"}</StampButton>
        </form>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-ink" : "text-redpen-text"}`}>{msg.text}</p>}
    </section>
  );
}
