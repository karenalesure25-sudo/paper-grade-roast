import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recoverOrderProgress } from "@/lib/fulfillment.functions";

export const Route = createFileRoute("/payment-success")({
  head: () => ({
    meta: [
      { title: "Check payment status — Kay’s Career Solutions" },
      { name: "description", content: "Check verified payment status on your private order page." },
      { property: "og:title", content: "Check payment status — Kay’s Career Solutions" },
      { property: "og:description", content: "Your private order page shows progress and downloads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentReturn,
});

function PaymentReturn() {
  const recover = useServerFn(recoverOrderProgress);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { recover({ data: {} }).then((r) => setToken(r?.token ?? null)).catch(() => undefined); }, [recover]);
  return (
    <div className="paper-texture min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="eyebrow">Payment status</p>
        <h1 className="mt-4 font-brand text-5xl text-ivory">Check your order.</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          This page does not confirm a payment. Your private order page checks with Stripe before showing payment confirmation or downloads.
        </p>
        {token && <Link to="/orders/$token" params={{ token }} className="mt-6 inline-block text-gold underline">Check my order</Link>}
        <Link to="/" className="mt-8 inline-block text-gold underline underline-offset-4">Back to home</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
