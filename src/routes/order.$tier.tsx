import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { StampButton } from "@/components/StampButton";
import { SiteFooter } from "@/components/SiteFooter";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PhotoCropper } from "@/components/PhotoCropper";
import { IntakeFlow, type SubmittedIntake } from "@/components/intake/IntakeFlow";
import { getTier, TIERS } from "@/lib/products";
import { startOrderCheckout } from "@/lib/fulfillment.functions";
import {
  PHOTO_LAYOUT_COUNT,
  RESUME_TEMPLATES,
  type TemplateId,
} from "@/lib/resume-templates";

export const Route = createFileRoute("/order/$tier")({
  beforeLoad: ({ params }) => {
    if (!getTier(params.tier)) throw notFound();
  },
  head: ({ params }) => {
    const tier = getTier(params.tier);
    const title = tier ? `${tier.name} — Kay’s Career Solutions` : "Order — Kay’s Career Solutions";
    const description = tier
      ? `${tier.tagline} $${tier.price}, one-time.`
      : "Pick your Kay’s Career Solutions résumé package.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: OrderPage,
});

function SectionLabel({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-stamp text-sm text-ink-soft">{String(step).padStart(2, "0")}</span>
      <h2 className="font-stamp text-xl text-ink sm:text-2xl">{children}</h2>
    </div>
  );
}


function OrderPage() {
  const { tier: tierId } = Route.useParams();
  const tier = getTier(tierId)!;
  const checkout = useServerFn(startOrderCheckout);
  const navigate = useNavigate();
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>("sidebar");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateUsesPhoto = RESUME_TEMPLATES.find((t) => t.id === template)?.usesPhoto ?? false;
  const layoutStep = tier.id === "bundle" ? 3 : 2;

  function handleIntake(intake: SubmittedIntake) {
    setIntakeId(intake.id);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  async function startPayment() {
    if (pending || !intakeId) return;
    if (templateUsesPhoto && !photo) {
      setError("Upload a photo and confirm its placement for this layout.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const r = await checkout({
        data: { intakeId, template, ...(templateUsesPhoto && photo ? { photo } : {}) },
      });
      if (r.already) {
        await navigate({ to: "/orders/$token", params: { token: r.token } });
        return;
      }
      // Same tab: Stripe returns the buyer to their private order page.
      window.location.assign(r.url);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Checkout couldn't start. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="paper-texture relative min-h-screen">
      <SiteHeader />
      <main className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow">
            ${tier.price} &middot; {tier.name}
          </p>
          <h1 className="mt-4 font-brand text-[2.7rem] leading-[1.02] text-ivory sm:text-6xl">{tier.name}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{tier.tagline}</p>

          {!intakeId && (
            <nav className="mt-6 flex flex-wrap gap-3">
              {TIERS.filter((other) => other.id !== tier.id).map((other) => (
                <Link
                  key={other.id}
                  to="/order/$tier"
                  params={{ tier: other.id }}
                  className="font-sans text-[0.85rem] text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
                >
                  Switch to {other.name} (${other.price})
                </Link>
              ))}
            </nav>
          )}

          {intakeId ? (
            <section className="mt-12 space-y-8">
              <div>
                <SectionLabel step={layoutStep}>Pick your layout</SectionLabel>
                <p className="mt-3 max-w-2xl font-sans text-[0.95rem] text-muted-foreground">
                  Your intake was saved. Preview the {RESUME_TEMPLATES.length} layouts ({PHOTO_LAYOUT_COUNT} use a
                  photo), then pay ${tier.price} securely with Stripe. Writing starts automatically once Stripe
                  confirms your payment.
                </p>
              </div>
              <TemplatePicker value={template} onChange={setTemplate} unlocked={false} />
              {templateUsesPhoto ? (
                <div>
                  <SectionLabel step={layoutStep + 1}>Your photo</SectionLabel>
                  <div className="mt-5">
                    <PhotoCropper round={template === "sidebar"} value={photo} onConfirm={setPhoto} />
                  </div>
                </div>
              ) : (
                <p className="font-hand text-2xl leading-tight text-redpen-text">
                  Plain sheet &mdash; no photo needed. Straight to the writing.
                </p>
              )}
              <div className="premium-panel p-6 sm:p-8">
                <StampButton type="button" onClick={startPayment} disabled={pending}>
                  {pending ? "Opening checkout..." : `Pay $${tier.price} with Stripe`}
                </StampButton>
                <p className="mt-5 font-sans text-[0.85rem] leading-relaxed text-muted-foreground">
                  After paying you land on your private order page. Keep that link: it shows progress and your
                  downloads, and it&rsquo;s the only way to reach your files.
                </p>
                {error && (
                  <p role="alert" className="mt-5 font-hand text-2xl leading-tight text-redpen-text">
                    {error}
                  </p>
                )}
              </div>
            </section>
          ) : (
            <IntakeFlow tier={tier} onSubmitted={handleIntake} />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
