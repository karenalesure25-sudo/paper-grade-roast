import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/payment-canceled")({
  head: () => ({
    meta: [
      { title: "Checkout canceled — Kay’s Career Solutions" },
      { name: "description", content: "No payment was taken. Return to your order tab whenever you're ready." },
      { property: "og:title", content: "Checkout canceled — Kay’s Career Solutions" },
      { property: "og:description", content: "No payment was taken." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="paper-texture min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="eyebrow">Checkout canceled</p>
        <h1 className="mt-4 font-brand text-5xl text-ivory">No payment was taken.</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Your order tab is still open — use &ldquo;Reopen checkout&rdquo; there when you&rsquo;re ready.
        </p>
        <Link to="/" className="mt-8 inline-block text-gold underline underline-offset-4">Back to home</Link>
      </main>
      <SiteFooter />
    </div>
  ),
});
