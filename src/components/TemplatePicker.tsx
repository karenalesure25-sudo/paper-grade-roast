import { RESUME_TEMPLATES, SAMPLE_RESUME, type TemplateId } from "@/lib/resume-templates";
import { ResumeTemplate } from "@/components/ResumeTemplate";

/**
 * Sample layouts, driven by RESUME_TEMPLATES. Before purchase the sample is shown with fake résumé
 * data and a blank photo slot, and everything below the header is blurred out.
 */
export function TemplatePicker({
  value,
  onChange,
  unlocked,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  unlocked: boolean;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {RESUME_TEMPLATES.map((template) => {
        const selected = template.id === value;
        return (
          <button
            key={template.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(template.id)}
            className={`group block min-h-11 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected ? "" : "opacity-90"
            }`}
          >
            <div
              className={`relative overflow-hidden rounded-lg border-2 bg-white shadow-paper ${
                unlocked ? "" : "locked-glow"
              } ${selected ? "border-accent" : "border-border"}`}
            >
              <div className="pointer-events-none h-[290px] origin-top overflow-hidden">
                <div className={unlocked ? "" : "[mask-image:linear-gradient(#000,#000)]"}>
                  <ResumeTemplate template={template.id} data={SAMPLE_RESUME} />
                </div>
              </div>

              {!unlocked && (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-[78px] bottom-0 backdrop-blur-[5px]"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-card/90 px-4 py-4 text-center">
                    <span className="font-sans text-[0.7rem] font-bold tracking-[0.12em] text-ivory uppercase">
                      Preview only
                    </span>
                    <span className="font-sans text-[0.7rem] text-muted-foreground">
                      Writing unlocks after verified payment
                    </span>
                  </div>
                </>
              )}

              {selected && (
                <span className="absolute top-2 right-2 rounded-full border border-accent bg-background px-2 py-1 font-sans text-[0.6rem] font-bold tracking-widest text-accent uppercase">
                  Chosen
                </span>
              )}
            </div>

            <p className="mt-3 font-sans text-sm font-semibold text-ivory">
              {template.name}
            </p>
            <p className="mt-1 font-sans text-[0.85rem] leading-relaxed text-muted-foreground">
              {template.blurb}
            </p>
            <p className="mt-1 font-sans text-[0.7rem] text-redpen-text">
              {template.usesPhoto ? "Uses your selfie" : "No photo"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
