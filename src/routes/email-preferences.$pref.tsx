import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StampButton } from "@/components/StampButton";
import { getEmailPreferences, submitOrderFeedback, updateEmailPreferences } from "@/lib/fulfillment.functions";

export const Route = createFileRoute("/email-preferences/$pref")({
  head: () => ({
    meta: [
      { title: "Email preferences — Kay's Career Solutions" },
      { name: "description", content: "Manage optional follow-up emails and share feedback about your Kay's Career Solutions order." },
      { property: "og:title", content: "Email preferences — Kay's Career Solutions" },
      { property: "og:description", content: "Manage optional follow-up emails and share feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PreferencesPage,
});

type Prefs = Awaited<ReturnType<typeof getEmailPreferences>>;

function PreferencesPage() {
  const { pref } = Route.useParams();
  const read = useServerFn(getEmailPreferences);
  const update = useServerFn(updateEmailPreferences);
  const send = useServerFn(submitOrderFeedback);
  const [prefs, setPrefs] = useState<Prefs | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [shareOk, setShareOk] = useState(false);
  const [sent, setSent] = useState(false);
  const valid = /^[a-f0-9]{64}$/.test(pref);

  useEffect(() => {
    if (!valid) { setPrefs(null); return; }
    read({ data: { pref } }).then(setPrefs).catch(() => setFailed(true));
  }, [pref, read, valid]);

  const toggle = async (optIn: boolean) => {
    setNote(null);
    try {
      const r = await update({ data: { pref, optIn } });
      if (r.ok && prefs) { setPrefs({ ...prefs, optedIn: r.optIn }); setNote(r.optIn ? "You’re subscribed to follow-ups." : "You’re unsubscribed. We won’t send follow-ups."); }
      else setNote("Couldn’t update this preference.");
    } catch { setNote("Couldn’t update right now. Please try again."); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) { setNote("Choose a rating from 1 to 5."); return; }
    try {
      const r = await send({ data: { pref, rating, comment: comment || undefined, shareOk } });
      if (r.ok) setSent(true); else setNote("Feedback isn’t available for this order.");
    } catch { setNote("Couldn’t send right now. Please try again."); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-5 py-12">
        <h1 className="font-display text-3xl">Email preferences</h1>
        {prefs === undefined && !failed && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {(failed || prefs === null) && <p className="mt-6 text-muted-foreground">This preference link isn’t valid. <Link to="/" className="underline">Return home</Link>.</p>}
        {prefs && (
          <>
            <section className="mt-6 border border-border p-5">
              <h2 className="text-lg font-semibold">Follow-up emails</h2>
              <p className="mt-2 text-sm text-muted-foreground">For your {prefs.packageName}: one optional check-in email about 12 days after delivery.</p>
              <p className="mt-3 text-sm">Status: <strong>{prefs.optedIn ? "Subscribed" : "Not subscribed"}</strong></p>
              <div className="mt-4">
                {prefs.optedIn
                  ? <StampButton type="button" onClick={() => toggle(false)}>Unsubscribe</StampButton>
                  : <StampButton type="button" onClick={() => toggle(true)}>Subscribe to follow-ups</StampButton>}
              </div>
            </section>
            {prefs.canGiveFeedback && (
              <section id="feedback" className="mt-6 border border-border p-5">
                <h2 className="text-lg font-semibold">Share honest feedback</h2>
                {sent || prefs.feedbackGiven ? (
                  <p className="mt-3 text-sm text-muted-foreground">Thank you — your feedback was received.{sent ? "" : " You can update it below."}</p>
                ) : null}
                {!sent && (
                  <form onSubmit={submit} className="mt-3 space-y-4">
                    <fieldset>
                      <legend className="text-sm">How would you rate your experience? You can also share any interview news in the comment.</legend>
                      <div className="mt-2 flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className={`cursor-pointer border px-3 py-2 text-sm ${rating === n ? "border-gold" : "border-border"}`}>
                            <input type="radio" name="rating" value={n} className="sr-only" checked={rating === n} onChange={() => setRating(n)} />
                            {n}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <label htmlFor="fb-comment" className="text-sm">Anything else? (optional — please don’t include personal details)</label>
                      <textarea id="fb-comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 h-28 w-full border border-border bg-background p-2 text-sm" />
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={shareOk} onChange={(e) => setShareOk(e.target.checked)} className="mt-1" />
                      <span>You may quote my comment anonymously on the website.</span>
                    </label>
                    <StampButton type="submit">Send feedback</StampButton>
                  </form>
                )}
              </section>
            )}
            <p className="mt-6 text-sm text-muted-foreground">Know someone job hunting? Share our website: <Link to="/" className="underline">kays-career-solutions</Link></p>
          </>
        )}
        {note && <p role="status" className="mt-4 text-sm">{note}</p>}
      </main>
      <SiteFooter />
    </div>
  );
}
