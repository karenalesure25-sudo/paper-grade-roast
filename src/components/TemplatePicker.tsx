import { RESUME_TEMPLATES, SAMPLE_RESUME, type TemplateId } from "@/lib/resume-templates";
import { ResumeTemplate } from "@/components/ResumeTemplate";

/**
 * Three sample layouts. Before purchase the sample is shown with fake résumé
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
            className={`group block text-left transition-transform hover:-translate-y-0.5 ${
              selected ? "" : "opacity-90"
            }`}
          >
            <div
              className={`relative overflow-hidden border-2 bg-white shadow-paper ${
                selected ? "border-redpen" : "border-border"
              }`}
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
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-paper/85 px-4 py-4 text-center">
                    <span className="font-stamp text-[0.7rem] tracking-[0.2em] text-redpen uppercase">
                      Sample &middot; locked
                    </span>
                    <span className="font-sans text-[0.7rem] text-muted-foreground">
                      Unlocks with your purchase
                    </span>
                  </div>
                </>
              )}

              {selected && (
                <span className="absolute top-2 right-2 bg-redpen px-2 py-1 font-stamp text-[0.6rem] tracking-widest text-primary-foreground uppercase">
                  Chosen
                </span>
              )}
            </div>

            <p className="mt-3 font-stamp text-sm tracking-wide text-ink uppercase">
              {template.name}
            </p>
            <p className="mt-1 font-sans text-[0.85rem] leading-relaxed text-muted-foreground">
              {template.blurb}
            </p>
            <p className="mt-1 font-sans text-[0.7rem] text-redpen">
              {template.usesPhoto ? "Uses your selfie" : "No photo"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
