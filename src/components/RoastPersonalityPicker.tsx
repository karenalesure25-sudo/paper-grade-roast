import { Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PersonaIdSchema, ROAST_PERSONAS, type PersonaId } from "@/lib/roast-personas";

export function RoastPersonalityPicker({ value, onChange, disabled = false }: {
  value: PersonaId | null; onChange: (value: PersonaId) => void; disabled?: boolean;
}) {
  return <section aria-labelledby="personality-heading" className="mt-10">
    <h2 id="personality-heading" className="font-brand text-3xl leading-tight text-ivory sm:text-4xl">Choose Your Roast Personality 🔥</h2>
    <p className="mt-3 text-base leading-relaxed text-muted-foreground">Your résumé is about to get roasted. Choose who’s delivering the heat.</p>
    <RadioGroup aria-labelledby="personality-heading" value={value ?? ""} disabled={disabled}
      onValueChange={(v) => { const parsed = PersonaIdSchema.safeParse(v); if (parsed.success) onChange(parsed.data); }}
      className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
      {ROAST_PERSONAS.map((p) => <label key={p.id} htmlFor={`persona-${p.id}`}
        className={`group relative flex min-w-0 flex-col rounded-xl border p-5 transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background ${value === p.id ? "border-primary bg-paper-shade shadow-paper-lift" : "border-border bg-card hover:border-accent"} ${disabled ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
        <span className="flex items-center justify-between gap-3"><span className="text-3xl" aria-hidden="true">{p.emoji}</span><RadioGroupItem id={`persona-${p.id}`} value={p.id} aria-label={p.name} /></span>
        <span className="mt-4 font-brand text-xl leading-tight text-ivory">{p.name}</span>
        <span className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</span>
        <span className="mt-4 border-t border-border pt-3 text-sm italic leading-relaxed text-ink">“{p.preview}”</span>
        <span className={`mt-auto flex min-h-10 items-end gap-2 pt-4 text-xs font-semibold ${value === p.id ? "text-primary" : "text-muted-foreground"}`}>
          {value === p.id ? <><Check className="size-4" aria-hidden="true" />Selected</> : "Choose this personality"}
        </span>
      </label>)}
    </RadioGroup>
  </section>;
}
