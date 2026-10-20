import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { StampButton } from "@/components/StampButton";
import { SiteFooter } from "@/components/SiteFooter";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PhotoCropper } from "@/components/PhotoCropper";
import { IntakeFlow, intakeSummaryRows, type SubmittedIntake } from "@/components/intake/IntakeFlow";
import { getTier, TIERS, type Tier } from "@/lib/products";
import { recoverOrderProgress, startOrderCheckout } from "@/lib/fulfillment.functions";
import { ServiceQuestionnaire } from "@/components/intake/ServiceQuestionnaire";
import { Button } from "@/components/ui/button";
import type { ServiceAnswers } from "@/lib/service-recommendation";
import { PHOTO_LAYOUT_COUNT, RESUME_TEMPLATES, type TemplateId } from "@/lib/resume-templates";

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

const STEPS = ["Service", "Your details", "Template", "Review & pay"] as const;
type StepIndex = 0 | 1 | 2 | 3;

function StepNav({ current }: { current: StepIndex }) {
  const pct = ((current + 1) / STEPS.length) * 100;
  return (
    <nav aria-label="Order progress" className="order-steps">
      {/* Mobile: compact progress, not a squeezed desktop list */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-ivory">
            Step {current + 1} of {STEPS.length} · {STEPS[current]}
          </span>
          {current < 3 && <span className="shrink-0 text-muted-foreground">Next: {STEPS[current + 1]}</span>}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-gold transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol className="hidden space-y-1 lg:block">
        {STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${state === "current" ? "bg-paper-shade text-ivory" : "text-muted-foreground"}`}>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${state === "done" ? "border-accent bg-accent text-accent-foreground" : state === "current" ? "border-accent text-accent" : "border-border"}`}>
                {state === "done" ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0 truncate font-semibold">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Summary({ tier, template, photoNeeded, photo }: { tier: Tier; template: TemplateId | null; photoNeeded: boolean; photo: string | null }) {
  const name = template ? RESUME_TEMPLATES.find((t) => t.id === template)?.name ?? template : null;
  return (
    <aside aria-label="Order summary" className="premium-panel p-5">
      <p className="eyebrow">Your order</p>
      <p className="mt-3 font-brand text-xl leading-tight text-ivory">{tier.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">${tier.price} USD · one-time</p>
      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Template</dt><dd className="min-w-0 truncate text-right text-ivory">{name ?? "Not chosen yet"}</dd></div>
        {template && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Photo</dt><dd className="text-right text-ivory">{photoNeeded ? (photo ? "Added" : "Needed") : "Not used"}</dd></div>}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Nothing is ordered or charged until you confirm on the review step and pay in Stripe’s secure checkout.</p>
    </aside>
  );
}

function OrderPage() {
  const { tier: tierId } = Route.useParams();
  const tier = getTier(tierId);
  const checkout = useServerFn(startOrderCheckout);
  const recover = useServerFn(recoverOrderProgress);
  const navigate = useNavigate();
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [intake, setIntake] = useState<SubmittedIntake | null>(null);
  const [stage, setStage] = useState<"template" | "review">("template");
  const [photo, setPhoto] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>("sidebar");
  const [templateChosen, setTemplateChosen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guided, setGuided] = useState(false);
  const [guide, setGuide] = useState<ServiceAnswers | undefined>();
  const [recovering, setRecovering] = useState(true);
  const [previous, setPrevious] = useState<{ token: string; tier: string } | null>(null);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setIntakeId(null);
    setIntake(null);
    setStage("template");
    setError(null);
    setPhoto(null);
    setTemplate("sidebar");
    setTemplateChosen(false);
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
        setTemplateChosen(true);
        setSelectionLocked(true);
        setStage("review");
      }
      // Recover the exact purchase snapshot, never a fresh default layout/photo.
      if (saved.intakeId) setIntakeId(saved.intakeId);
      else if (saved.token) await navigate({ to: "/orders/$token", params: { token: saved.token } });
    }).catch(() => { if (active) setError("Saved progress couldn’t be checked. Please try refreshing before starting again."); }).finally(() => { if (active) setRecovering(false); });
    return () => { active = false; };
  }, [tierId, recover, navigate]);

  const templateUsesPhoto = RESUME_TEMPLATES.find((t) => t.id === template)?.usesPhoto ?? false;
  if (!tier) return null;
  const step: StepIndex = !intakeId ? (guided ? 1 : 0) : stage === "template" ? 2 : 3;

  function toTop() {
    requestAnimationFrame(() => workspace.current?.scrollIntoView({ block: "start" }));
  }

  function handleIntake(saved: SubmittedIntake) {
    setIntakeId(saved.id);
    setIntake(saved);
    setStage("template");
    setError(null);
    toTop();
  }

  function startNewIntake() {
    setIntakeId(null); setIntake(null); setSelectionLocked(false); setTemplate("sidebar"); setTemplateChosen(false);
    setPhoto(null); setError(null); setGuided(true); setStage("template"); toTop();
  }

  function toReview() {
    if (templateUsesPhoto && !photo) return setError("Upload a photo and confirm its placement for this template.");
    setError(null);
    setTemplateChosen(true);
    setStage("review");
    toTop();
  }

  async function startPayment() {
    if (pending || !intakeId) return;
    if (templateUsesPhoto && !photo) {
      setError("Upload a photo and confirm its placement for this template.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      // The order snapshot (service, price, template, photo) is created only here.
      const r = await checkout({
        data: { intakeId, template, ...(templateUsesPhoto && photo ? { photo } : {}) },
      });
      if (r.already) {
        await navigate({ to: "/orders/$token", params: { token: r.token } });
        return;
      }
      window.location.assign(r.url);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Checkout couldn't start. Nothing was charged — try again.");
      setPending(false);
    }
  }

  const templateName = RESUME_TEMPLATES.find((t) => t.id === template)?.name ?? template;
  const reviewRows = intake ? intakeSummaryRows(tier, intake.answers, intake.resume, intake.jobFile) : [];

  return (
    <div className="paper-texture relative min-h-screen">
      <SiteHeader />
      <main className="px-4 pt-8 pb-14 sm:px-6 sm:pt-12">
        <div className="mx-auto max-w-6xl">
          <header className="grid gap-2">
            <p className="eyebrow">${tier.price} · {tier.name}</p>
            <h1 className="font-brand text-[2.2rem] leading-[1.05] text-ivory sm:text-5xl">{tier.name}</h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{tier.tagline}</p>
          </header>

          {previous && (
            <p role="status" className="mt-5 border-l-2 border-gold pl-3 text-sm text-muted-foreground">
              You have an earlier order.{" "}
              <Link to="/orders/$token" params={{ token: previous.token }} className="text-gold underline underline-offset-4">View that order</Link>
              {" "}— or continue below to start a new one.
            </p>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_260px] lg:items-start">
            <div className="lg:sticky lg:top-32"><StepNav current={step} /></div>

            <div ref={workspace} className="min-w-0 scroll-mt-28 sm:scroll-mt-32">
              {recovering ? (
                <p role="status" className="premium-panel p-6 text-muted-foreground">Checking your saved progress…</p>
              ) : step === 0 ? (
                <>
                  <ServiceQuestionnaire key={tier.id} tier={tier} {...(guide ? { initial: guide } : {})} onContinue={async (answers, selected) => {
                    setGuide(answers);
                    if (selected !== tier.id) await navigate({ to: "/order/$tier", params: { tier: selected } });
                    setGuided(true);
                    toTop();
                  }} />
                  <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                    {TIERS.filter((other) => other.id !== tier.id).map((other) => (
                      <Link key={other.id} to="/order/$tier" params={{ tier: other.id }} className="text-[0.85rem] text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-ink">
                        Switch to {other.name} (${other.price})
                      </Link>
                    ))}
                  </nav>
                </>
              ) : step === 1 ? (
                <>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-brand text-2xl text-ivory sm:text-3xl">Your résumé & details</h2>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setGuided(false); toTop(); }}>← Back to service</Button>
                  </div>
                  <IntakeFlow key={tier.id} tier={tier} initialAnswers={{ targetJobTitle: guide?.targetRole ?? "", specificJobTitle: guide?.targetRole ?? "", jobDescription: guide?.jobDescription ?? "" }} onSubmitted={handleIntake} />
                </>
              ) : step === 2 ? (
                <section className="space-y-6">
                  <div className="premium-panel p-5 sm:p-7">
                    <p className="eyebrow">Step 3 · Template</p>
                    <h2 className="mt-3 font-brand text-2xl text-ivory sm:text-3xl">Pick your template</h2>
                    <p className="mt-3 text-[0.95rem] text-muted-foreground">
                      Your details are saved (no order yet). Choose one of {RESUME_TEMPLATES.length} templates — {PHOTO_LAYOUT_COUNT} use a photo.
                    </p>
                  </div>
                  <fieldset disabled={pending}>
                    <legend className="sr-only">Résumé template</legend>
                    <TemplatePicker value={template} onChange={(id) => { setTemplate(id); setError(null); }} unlocked={false} />
                  </fieldset>
                  {templateUsesPhoto ? (
                    <div className="premium-panel p-5 sm:p-7">
                      <h3 className="font-brand text-xl text-ivory">Your photo</h3>
                      <div className="mt-4"><PhotoCropper round={template === "sidebar"} value={photo} onConfirm={setPhoto} /></div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">This template doesn’t use a photo.</p>
                  )}
                  {error && <p role="alert" className="text-redpen-text">{error}</p>}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="outline" onClick={startNewIntake}>← Edit details</Button>
                    <StampButton type="button" onClick={toReview}>Continue to review</StampButton>
                  </div>
                </section>
              ) : (
                <section className="space-y-6">
                  <div className="premium-panel p-5 sm:p-7">
                    <p className="eyebrow">Step 4 · Review & pay</p>
                    <h2 className="mt-3 font-brand text-2xl text-ivory sm:text-3xl">Review your order</h2>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                      <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Service</dt><dd className="mt-1 text-ivory">{tier.name}</dd></div>
                      <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Price</dt><dd className="mt-1 text-ivory">${tier.price} USD, one-time</dd></div>
                      <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Template</dt><dd className="mt-1 text-ivory">{templateName}</dd></div>
                    </dl>
                    {templateUsesPhoto && photo && <img src={photo} alt="Your chosen photo" className="mt-5 h-28 w-28 rounded-lg object-cover" />}
                    {selectionLocked && (
                      <p role="status" className="mt-5 text-sm text-muted-foreground">
                        This saved order keeps the template and photo you chose earlier. For a different template,{" "}
                        <button type="button" className="text-gold underline underline-offset-4" disabled={pending} onClick={startNewIntake}>start a new intake</button>.
                      </p>
                    )}
                  </div>
                  {reviewRows.length > 0 && (
                    <div className="premium-panel p-5 sm:p-7">
                      <h3 className="font-brand text-xl text-ivory">Your details</h3>
                      <dl className="mt-3 divide-y divide-border">
                        {reviewRows.map(([k, v]) => (
                          <div key={k} className="py-3">
                            <dt className="text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
                            <dd className="mt-1 max-h-48 overflow-y-auto text-[0.95rem] break-words whitespace-pre-wrap text-ink">{v.trim() ? v : <span className="text-muted-foreground">Not provided</span>}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  <div className="premium-panel p-5 sm:p-7">
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {!selectionLocked && <Button type="button" variant="outline" disabled={pending} onClick={() => { setStage("template"); toTop(); }}>← Change template</Button>}
                      <StampButton type="button" onClick={startPayment} disabled={pending || !templateChosen}>
                        {pending ? "Opening secure checkout…" : `Place order & pay $${tier.price}`}
                      </StampButton>
                    </div>
                    <p className="mt-4 text-[0.85rem] leading-relaxed text-muted-foreground">
                      Your order is created when you press this button, then you pay in Stripe’s secure checkout. Afterwards you land on your private order page — keep that link: it shows progress and your downloads.
                    </p>
                    {error && <p role="alert" className="mt-4 text-redpen-text">{error}</p>}
                  </div>
                </section>
              )}
              {!intakeId && error && <p role="alert" className="mt-5 text-redpen-text">{error}</p>}
            </div>

            <div className="lg:sticky lg:top-32">
              <Summary tier={tier} template={intakeId && templateChosen ? template : intakeId ? template : null} photoNeeded={templateUsesPhoto} photo={photo} />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
