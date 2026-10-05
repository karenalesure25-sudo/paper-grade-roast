import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/payment-success")({
  head: () => ({
    meta: [
      { title: "Payment complete — Kay’s Career Solutions" },
      { name: "description", content: "Your payment went through. Return to your order tab to get your résumé written." },
      { property: "og:title", content: "Payment complete — Kay’s Career Solutions" },
      { property: "og:description", content: "Return to your order tab to get your résumé written." },
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
          Go back to your order tab and press &ldquo;I&rsquo;ve paid — write my résumé&rdquo;. We
          confirm the payment with Stripe before writing starts. You can close this tab.
        </p>
        <Link to="/" className="mt-8 inline-block text-gold underline underline-offset-4">Back to home</Link>
      </main>
      <SiteFooter />
    </div>
  ),
});
