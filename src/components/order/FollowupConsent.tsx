import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { setFollowupConsent } from "@/lib/fulfillment.functions";

/** Optional, default-off consent for at most two follow-up emails. Stored server-side per order. */
export function FollowupConsent({ token, initial }: { token: string; initial: boolean }) {
  const save = useServerFn(setFollowupConsent);
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const change = async (next: boolean) => {
    setBusy(true); setNote(null);
    try {
      const r = await save({ data: { token, optIn: next } });
      if (r.ok) { setOn(r.optIn); setNote(r.optIn ? "Saved. You can change this anytime." : "Saved. We won’t send follow-ups."); }
      else setNote("This option isn’t available for this order.");
    } catch { setNote("Couldn’t save right now. Please try again."); }
    setBusy(false);
  };
  return (
    <div className="mt-5 border border-border p-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-gold" checked={on} disabled={busy} onChange={(e) => change(e.target.checked)} />
        <span>
          <span className="font-medium text-foreground">Optional: send me one check-in email after delivery.</span>
          <span className="block text-muted-foreground">A single note about 12 days after your files arrive, inviting feedback and asking how your applications are going. Unsubscribe anytime.</span>
        </span>
      </label>
      {note && <p role="status" className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
