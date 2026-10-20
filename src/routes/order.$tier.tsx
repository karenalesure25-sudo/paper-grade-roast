import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { StampButton } from "@/components/StampButton";
import { SiteFooter } from "@/components/SiteFooter";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PhotoCropper } from "@/components/PhotoCropper";
import { IntakeFlow, type SubmittedIntake } from "@/components/intake/IntakeFlow";
import { getTier, TIERS } from "@/lib/products";
import { recoverOrderProgress, startOrderCheckout } from "@/lib/fulfillment.functions";
import { ServiceQuestionnaire } from "@/components/intake/ServiceQuestionnaire";
import { Button } from "@/components/ui/button";
import type { ServiceAnswers } from "@/lib/service-recommendation";
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
  const tier = getTier(tierId);
  const checkout = useServerFn(startOrderCheckout);
  const recover = useServerFn(recoverOrderProgress);
  const navigate = useNavigate();
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>("sidebar");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guided, setGuided] = useState(false);
  const [guide, setGuide] = useState<ServiceAnswers | undefined>();
  const [recovering, setRecovering] = useState(true);
  const [previous, setPrevious] = useState<{ token: string; tier: string } | null>(null);
  const [selectionLocked, setSelectionLocked] = useState(false);
  useEffect(() => {
    let active = true;
    setIntakeId(null);
    setError(null);
    setPhoto(null);
    setTemplate("sidebar");
    setRecovering(true);
    setPrevious(null);
    setSelectionLocked(false);
    recover({ data: { tier: tierId as "revamp" | "scratch" | "bundle" } }).then(async (saved) => {
      if (!active || !saved) return;
      setPrevious(saved.previous);
      if ("selection" in saved && saved.selection) {
        const selection = saved.selection;
        const layout = RESUME_TEMPLATES.find((t) => t.id === selection.template);
        if (!layout) throw new Error("Saved layout unavailable.");
        setTemplate(layout.id);
        setPhoto(selection.photo);
        setSelectionLocked(true);
      }
      // Recover the exact purchase snapshot, never a fresh default layout/photo.
      if (saved.intakeId) setIntakeId(saved.intakeId);
      else if (saved.token) await navigate({ to: "/orders/$token", params: { token: saved.token } });
    }).catch(() => { if (active) setError("Saved progress couldn’t be checked. Please try refreshing before starting again."); }).finally(() => { if (active) setRecovering(false); });
    return () => { active = false; };
  }, [tierId, recover, navigate]);
  const templateUsesPhoto = RESUME_TEMPLATES.find((t) => t.id === template)?.usesPhoto ?? false;
  if (!tier) return null;
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

          <ol aria-label="Order steps" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className={!guided && !intakeId ? "text-gold" : ""}>01 · Service</li><li className={guided && !intakeId ? "text-gold" : ""}>02 · Intake & review</li><li className={intakeId ? "text-gold" : ""}>03 · Layout & checkout</li>
          </ol>
          {previous && (
            <p role="status" className="mt-6 border-l-2 border-gold pl-3 text-sm text-muted-foreground">
              You have an earlier order.{" "}
              <Link to="/orders/$token" params={{ token: previous.token }} className="text-gold underline underline-offset-4">View that order</Link>
              {" "}— or continue below to start a new one.
            </p>
          )}
          {recovering ? <p role="status" className="mt-8 text-muted-foreground">Checking your saved progress…</p> : intakeId ? (
            <section className="mt-12 space-y-8">
              <div>
                <SectionLabel step={layoutStep}>Pick your layout</SectionLabel>
                <p className="mt-3 max-w-2xl font-sans text-[0.95rem] text-muted-foreground">
                  Your intake was saved. Review the {RESUME_TEMPLATES.length} layouts ({PHOTO_LAYOUT_COUNT} use a
                  photo), then pay ${tier.price} securely with Stripe. Writing starts automatically once Stripe
                  confirms your payment.
                </p>
              </div>
              {selectionLocked && <div>
                <p role="status" className="text-sm text-muted-foreground">This saved order keeps the layout and photo you chose before checkout. A different layout needs a new intake.</p>
                <Button type="button" variant="link" disabled={pending} onClick={() => { setIntakeId(null); setSelectionLocked(false); setTemplate("sidebar"); setPhoto(null); setError(null); setGuided(true); }}>Start a new intake</Button>
              </div>}
              <fieldset disabled={selectionLocked || pending}>
                <legend className="sr-only">Résumé layout</legend>
                <TemplatePicker value={template} onChange={setTemplate} unlocked={false} />
              </fieldset>
              {templateUsesPhoto ? (
                <div>
                  <SectionLabel step={layoutStep + 1}>Your photo</SectionLabel>
                  <div className="mt-5">
                    {selectionLocked && photo ? <img src={photo} alt="Your saved order photo" className="h-40 w-40 rounded-lg object-cover" /> : <PhotoCropper round={template === "sidebar"} value={photo} onConfirm={setPhoto} />}
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
          ) : guided ? (
            <>
              <Button type="button" variant="link" className="mt-6" onClick={() => setGuided(false)}>Edit service answers</Button>
              <IntakeFlow key={tier.id} tier={tier} initialAnswers={{ targetJobTitle: guide?.targetRole ?? "", specificJobTitle: guide?.targetRole ?? "", jobDescription: guide?.jobDescription ?? "" }} onSubmitted={handleIntake} />
            </>
          ) : (
            <ServiceQuestionnaire key={tier.id} tier={tier} {...(guide ? { initial: guide } : {})} onContinue={async (answers, selected) => {
              setGuide(answers);
              if (selected !== tier.id) await navigate({ to: "/order/$tier", params: { tier: selected } });
              setGuided(true);
            }} />
          )}
          {!intakeId && <p className="mt-5 text-sm text-muted-foreground">Your intake is saved when you submit it. Unsubmitted answers and photos stay on this page only.</p>}
          {!intakeId && error && <p role="alert" className="mt-5 text-redpen-text">{error}</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
