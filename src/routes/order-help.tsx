import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StampButton } from "@/components/StampButton";
import { getEmailAvailability, requestOrderLinks } from "@/lib/fulfillment.functions";

export const Route = createFileRoute("/order-help")({
  head: () => ({
    meta: [
      { title: "Order help — Kay’s Career Solutions" },
      { name: "description", content: "Find your private order page, check progress and get your résumé files." },
      { property: "og:title", content: "Order help — Kay’s Career Solutions" },
      { property: "og:description", content: "How to get back to your private order page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  staticData: { sitemap: true },
  component: OrderHelp,
});

function OrderHelp() {
  const availability = useServerFn(getEmailAvailability);
  const send = useServerFn(requestOrderLinks);
  const [active, setActive] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    availability().then((r) => setActive(r.active)).catch(() => setActive(false));
  }, [availability]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await send({ data: { email } });
      setMsg(r.message);
    } catch {
      setMsg("Something went wrong. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper-texture relative min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl text-ink uppercase sm:text-5xl">Order help</h1>
        <section className="mt-8 space-y-3 font-sans leading-relaxed text-muted-foreground">
          <p>After checkout, Stripe sends you back to your private order page. That page shows progress, any questions we need answered, and your downloads. Your package keeps processing even if you close the tab.</p>
          <p>On the same device and browser you ordered from, starting the same package again also brings you back to your saved order.</p>
        </section>

        <section className="premium-panel mt-10 p-6" aria-labelledby="resend-title">
          <h2 id="resend-title" className="font-display text-xl text-ink uppercase">Resend my order links</h2>
          {active === false && (
            <p className="mt-3 text-sm text-muted-foreground" role="status">
              Email delivery isn&rsquo;t switched on yet, so we can&rsquo;t resend links. Please use the private order link from your checkout return page.
            </p>
          )}
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="sr-only" htmlFor="recover-email">Email used at checkout</label>
            <input
              id="recover-email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={!active || busy}
              placeholder="Email used at checkout"
              className="min-h-11 min-w-0 rounded-md border border-border bg-card px-3 text-ink disabled:opacity-60"
            />
            <StampButton type="submit" disabled={!active || busy}>{busy ? "Sending…" : "Email my links"}</StampButton>
          </form>
          {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
        </section>
        <p className="mt-10 text-sm text-muted-foreground">See our <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy notice</Link>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
