import type { AtsReport } from "@/lib/order.functions";

function scoreVerdict(score: number): string {
  if (score >= 85) return "Strong match";
  if (score >= 70) return "Good keyword match";
  if (score >= 55) return "Borderline";
  return "Needs work";
}

export function AtsReportCard({
  report,
  jobLabel,
}: {
  report: AtsReport;
  jobLabel?: string | undefined;
}) {
  return (
    <div className="border border-border bg-card p-6 shadow-paper sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-sans text-xl tracking-tight text-ink">
            ATS keyword estimate (advisory)
          </h3>
          {jobLabel ? (
            <p className="mt-2 font-sans text-[0.95rem] text-muted-foreground">
              Compared with <span className="marker break-all">{jobLabel}</span>
            </p>
          ) : null}
          <p className="mt-2 font-sans text-[0.8rem] text-muted-foreground">
            An AI estimate of keyword overlap with this posting — not a score from any employer&rsquo;s real applicant tracking system.
          </p>
        </div>

        <div
          className="shrink-0 rotate-[-4deg] border-4 border-redpen px-6 py-3 text-center"
          aria-label={`Advisory keyword match estimate ${report.score} out of 100`}
        >
          <div className="font-sans text-4xl leading-none text-redpen-text">
            {report.score}
            <span className="text-lg">/100</span>
          </div>
          <div className="mt-1 font-typewriter text-[0.65rem] tracking-[0.2em] uppercase text-ink-soft">
            {scoreVerdict(report.score)}
          </div>
        </div>
      </div>

      {report.verdict ? (
        <p className="mt-6 font-sans text-[0.95rem] leading-relaxed text-ink">
          {report.verdict}
        </p>
      ) : null}

      {report.factors.length > 0 && (
        <div className="mt-8">
          <h4 className="font-typewriter text-xs tracking-[0.2em] uppercase text-muted-foreground">
            How the score adds up
          </h4>
          <ul className="mt-4 space-y-4">
            {report.factors.map((factor) => (
              <li
                key={factor.label}
                className="border-l-2 border-ink-soft/40 pl-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-sans text-[0.95rem] text-ink">
                    {factor.label}
                  </span>
                  <span className="font-sans text-[0.95rem] text-ink-soft">
                    {factor.points > 0 ? `+${factor.points}` : factor.points}
                  </span>
                </div>
                {factor.detail ? (
                  <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">
                    {factor.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.matched.length > 0 && (
        <div className="mt-8">
          <h4 className="font-typewriter text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Matched keywords ({report.matched.length})
          </h4>
          <ul className="mt-4 flex flex-wrap gap-2">
            {report.matched.map((item) => (
              <li
                key={item.keyword}
                className="border border-border bg-paper-shade px-3 py-1.5 font-sans text-[0.85rem] text-ink"
                title={item.where}
              >
                <span className="highlighter">{item.keyword}</span>
                {item.where ? (
                  <span className="ml-2 text-muted-foreground">{item.where}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.missing.length > 0 && (
        <div className="mt-8">
          <h4 className="font-typewriter text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Still missing from the posting
          </h4>
          <ul className="mt-4 space-y-3">
            {report.missing.map((item) => (
              <li key={item.keyword}>
                <span className="font-hand text-2xl leading-none text-redpen-text">
                  {item.keyword}
                </span>
                {item.why ? (
                  <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">
                    {item.why}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
