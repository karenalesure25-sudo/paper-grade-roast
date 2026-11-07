import { ROAST_PERSONAS, type PersonaId, type PersonalitySections } from "@/lib/roast-personas";
import { SECTION_LABEL, type Evidence, type LetterGrade } from "@/lib/roast-grounding";

export function PersonalityRoast({ persona, sections, grade, notes }: {
  persona: PersonaId; sections: PersonalitySections; grade: LetterGrade; notes: Evidence[];
}) {
  const selected = ROAST_PERSONAS.find((p) => p.id === persona)!;
  return <div className="space-y-7 break-words text-[0.95rem] leading-relaxed text-ink">
    <p className="text-sm font-semibold text-primary">{selected.emoji} {selected.name}</p>
    <section><h3 className="font-brand text-2xl text-ivory">🔥 The Vibe Check</h3><p className="mt-2 font-semibold">Grade: {grade}</p><p className="mt-2">{sections.vibe}</p></section>
    <section><h3 className="font-brand text-2xl text-ivory">🚩 Red Flags</h3>
      {notes.length ? <ul className="mt-3 space-y-4">{notes.map((n, i) => <li key={i}>
        <p>{sections.redFlags[i]}</p><p className="mt-1 text-sm text-muted-foreground">{n.quote ? <>From your résumé: “{n.quote}”</> : n.missing ? <>We didn’t find {SECTION_LABEL[n.missing]} in the text.</> : null}</p>
      </li>)}</ul> : <p className="mt-2">No verified red flags. Any improvements below are optional polish.</p>}
    </section>
    <section><h3 className="font-brand text-2xl text-ivory">✨ The Glow Up</h3><p className="mt-2">{sections.glowUp}</p>
      {sections.rewrite && <dl className="mt-4 space-y-3 rounded-r-md border-l-2 border-primary bg-paper-shade/40 p-4">
        <div><dt className="font-semibold text-muted-foreground">Before</dt><dd>{sections.rewrite.before}</dd></div>
        <div><dt className="font-semibold text-primary">After</dt><dd>{sections.rewrite.after}</dd></div>
      </dl>}
    </section>
    <section><h3 className="font-brand text-2xl text-ivory">📋 ATS &amp; Formatting Check</h3><p className="mt-2">{sections.ats}</p>
      <p className="mt-3 text-sm text-muted-foreground">This review uses extracted text. Fonts, columns, spacing and page count cannot be checked here. General tip: use clear section headings and confirm that text copies from your exported file in the right order. No job description was supplied, so this is not an ATS match score.</p>
    </section>
    <section><h3 className="font-brand text-2xl text-ivory">🎤 Final Sign-Off</h3><p className="mt-2">{sections.signOff}</p></section>
  </div>;
}
