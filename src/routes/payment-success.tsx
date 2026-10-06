import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/payment-success")({
  head: () => ({
    meta: [
      { title: "Payment complete — Kay’s Career Solutions" },
      { name: "description", content: "Your payment went through. Your private order page shows progress and downloads." },
      { property: "og:title", content: "Payment complete — Kay’s Career Solutions" },
      { property: "og:description", content: "Your private order page shows progress and downloads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="paper-texture min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="eyebrow">Checkout complete</p>
        <h1 className="mt-4 font-brand text-5xl text-ivory">Thank you.</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Writing starts automatically once Stripe confirms your payment. Follow
          your private order page link to see progress and download your files.
        </p>
        <Link to="/" className="mt-8 inline-block text-gold underline underline-offset-4">Back to home</Link>
      </main>
      <SiteFooter />
    </div>
  ),
});
