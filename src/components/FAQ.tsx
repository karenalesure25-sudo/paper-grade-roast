const questions = [
  ["Is the résumé roast really free?", "Yes. You can upload a PDF or DOCX, or paste your résumé text. No account or payment is required."],
  ["How is the feedback checked?", "The grade is based on the résumé text we can read. Claims and quoted evidence are checked against that source, then a separate fact-check must approve the result before it appears. This reduces mistakes, but no AI review can guarantee perfect accuracy."],
  ["What happens to my résumé?", "Free-roast text is sent to an outside AI service for analysis. The résumé and result are not saved to our database; the result stays in your browser tab until you clear it or close the tab."],
  ["Can I buy a service today?", "Yes. Complete the intake form for your service, pick a layout, then pay securely through Stripe. Your résumé is written only after Stripe confirms the payment."],
  ["Does every package include job tailoring?", "No. Resume Revamp is a general professional rewrite. Résumé From Scratch builds a new résumé from your background. Only the $60 Revamp + ATS Optimization service is tailored to one specific job and includes a matching cover letter."],
];

export function FAQ() {
  return (
    <section id="faq" className="section-shell border-t border-border/60">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="eyebrow">Good to know</p>
            <h2 className="section-title mt-4">Straight answers before you start.</h2>
          </div>
          <div className="divide-y divide-border">
            {questions.map(([question, answer]) => (
              <details key={question} className="group py-5 first:pt-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-sans text-base font-semibold text-ivory marker:content-none">
                  {question}<span aria-hidden className="text-xl font-light text-gold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-2xl pb-1 pr-8 font-sans text-[0.95rem] leading-7 text-muted-foreground">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}