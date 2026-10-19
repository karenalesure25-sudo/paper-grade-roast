import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recoverOrderProgress } from "@/lib/fulfillment.functions";

export const Route = createFileRoute("/payment-canceled")({
  head: () => ({
    meta: [
      { title: "Checkout canceled — Kay’s Career Solutions" },
      { name: "description", content: "Return to your saved order and check payment status securely." },
      { property: "og:title", content: "Checkout canceled — Kay’s Career Solutions" },
      { property: "og:description", content: "Return to your saved order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CanceledReturn,
});

function CanceledReturn() {
  const recover = useServerFn(recoverOrderProgress);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { recover({ data: {} }).then((r) => setToken(r?.token ?? null)).catch(() => undefined); }, [recover]);
  return (
    <div className="paper-texture min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="eyebrow">Checkout canceled</p>
        <h1 className="mt-4 font-brand text-5xl text-ivory">Checkout paused.</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Return to your saved order to check payment status or reopen secure checkout. A canceled checkout alone does not confirm a charge.
        </p>
        {token && <Link to="/orders/$token" params={{ token }} className="mt-6 inline-block text-gold underline">Return to my order</Link>}
        <Link to="/" className="mt-8 inline-block text-gold underline underline-offset-4">Back to home</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
