import { useState } from "react";
import { StampButton } from "@/components/StampButton";
import { Button } from "@/components/ui/button";
import { TIERS, type Tier, type TierId } from "@/lib/products";
import { recommendService, type ServiceAnswers } from "@/lib/service-recommendation";

export function ServiceQuestionnaire({ tier, initial, onContinue }: {
  tier: Tier; initial?: ServiceAnswers;
  onContinue: (answers: ServiceAnswers, selected: TierId) => void;
}) {
  const [hasResume, setHasResume] = useState<boolean | undefined>(initial?.hasResume);
  const [goal, setGoal] = useState<ServiceAnswers["goal"] | undefined>(initial?.goal);
  const [coverLetter, setCoverLetter] = useState<boolean | undefined>(initial?.coverLetter);
  const [targetRole, setTargetRole] = useState(initial?.targetRole ?? "");
  const [jobDescription, setJobDescription] = useState(initial?.jobDescription ?? "");
  const [choice, setChoice] = useState<TierId>(tier.id);
  const [error, setError] = useState("");
  const answers = { hasResume, goal, coverLetter, targetRole, jobDescription };
  const recommendation = recommendService(answers);
  const selected = TIERS.find((t) => t.id === choice) ?? tier;
  function options(label: string, value: boolean | string | undefined, items: Array<[boolean | string, string]>, change: (v: any) => void) {
    return <fieldset className="space-y-3"><legend className="mb-3 font-semibold text-ivory">{label}</legend>
      <div className="flex flex-wrap gap-3">{items.map(([v, text]) => <label key={String(v)} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 ${value === v ? "border-gold bg-paper-shade text-ivory" : "border-border text-muted-foreground"}`}>
        <input type="radio" name={label} checked={value === v} onChange={() => change(v)} className="accent-accent" />{text}
      </label>)}</div></fieldset>;
  }
  return <form className="space-y-6" onSubmit={(e) => {
    e.preventDefault();
    if (!recommendation || hasResume === undefined || goal === undefined || coverLetter === undefined) return setError("Answer each question to continue.");
    if ((choice === "scratch" || choice === "bundle") && !targetRole.trim()) return setError("Add your target role to continue.");
    onContinue({ hasResume, goal, coverLetter, targetRole, jobDescription }, choice);
  }}>
    <section className="premium-panel space-y-7 p-5 sm:p-7">
      <div><p className="eyebrow">Step 1 · Find your service</p><h2 className="mt-3 font-brand text-[1.7rem] leading-tight text-ivory sm:text-3xl">What’s next for your résumé?</h2></div>
      {options("Do you have an existing résumé?", hasResume, [[true, "Yes"], [false, "Not yet"]], setHasResume)}
      {options("What would you like help with?", goal, [["polish", "General polish"], ["target", "A specific job"]], setGoal)}
      {options("Do you need a cover letter?", coverLetter, [[true, "Yes"], [false, "No"]], setCoverLetter)}
      {(hasResume === false || goal === "target" || coverLetter === true || choice === "scratch" || choice === "bundle") && <div>
        <label htmlFor="guide-role" className="font-semibold text-ivory">Target role</label>
        <input id="guide-role" value={targetRole} maxLength={120} onChange={(e) => setTargetRole(e.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-border bg-paper-shade p-3 text-ivory focus:border-gold" />
      </div>}
      {(goal === "target" || coverLetter === true) && hasResume === true && <div>
        <label htmlFor="guide-job" className="font-semibold text-ivory">Job description <span className="font-normal text-muted-foreground">(or upload the posting in the next step)</span></label>
        <textarea id="guide-job" value={jobDescription} maxLength={24000} rows={5} onChange={(e) => setJobDescription(e.target.value)} className="mt-2 w-full rounded-md border border-border bg-paper-shade p-3 text-ivory focus:border-gold" />
      </div>}
    </section>
    {recommendation && <section aria-live="polite" className="border-l-2 border-gold pl-5">
      <p className="eyebrow">Our recommendation</p><h2 className="mt-2 font-brand text-2xl text-ivory">{TIERS.find((t) => t.id === recommendation.tier)?.name}</h2>
      <p className="mt-3 text-muted-foreground">{recommendation.reason}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={() => setChoice(recommendation.tier)}>Choose recommended service</Button>
    </section>}
    <section className="premium-panel p-5 sm:p-7">
      <label htmlFor="guide-service" className="font-semibold text-ivory">Your selected service</label>
      <select id="guide-service" value={choice} onChange={(e) => setChoice(e.target.value as TierId)} className="mt-3 min-h-12 w-full rounded-md border border-border bg-paper-shade p-3 text-ivory">
        {TIERS.map((t) => <option key={t.id} value={t.id}>{t.name} — ${t.price}</option>)}
      </select>
      <p className="mt-4 font-semibold text-ivory">${selected.price} USD · One-time payment</p>
      <ul className="mt-4 space-y-2 text-muted-foreground">{selected.includes.map((item) => <li key={item}>✓ {item}</li>)}</ul>
      <p className="mt-4 text-sm text-muted-foreground">Your selection stays unchanged unless you choose another service. You’ll review service, price and template before secure Stripe Checkout.</p>
      {choice === "bundle" && <p className="mt-3 text-sm text-muted-foreground">A current résumé and one full job posting are required.</p>}
      {choice === "revamp" && hasResume === false && <p className="mt-3 text-redpen-text">This service requires an existing résumé.</p>}
      <StampButton type="submit" className="mt-6">Continue to your details</StampButton>
      {error && <p role="alert" className="mt-3 text-redpen-text">{error}</p>}
    </section>
  </form>;
}