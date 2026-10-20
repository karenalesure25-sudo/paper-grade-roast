# Premium + viral readiness review (read-only findings, nothing implemented)

Status legend: PRESENT = seen in code this turn. MISSING = searched for and not found. PROPOSAL = recommendation only.
Not re-checked this turn: Stripe webhook registration, background worker schedule, email sender. Treat them as still blocked, as reported before.

## 1. Founder trust: there's no "who is Kay" (highest impact, smallest change)
- PRESENT: `CareerStatement` in `src/components/CareerHomepage.tsx` (`#about`, "The Kay's approach"). It's a headline plus one paragraph, with no person, name, credentials or photo. The nav "About" link points here.
- MISSING: founder name, background, credentials, any testimonials or reviews (none found anywhere).
- PROPOSAL, portrait placement: put a small rounded portrait (about 96–120px) inside `CareerStatement`, in the existing right-hand `<div>` beside `statement-line`, followed by a one-line caption ("Kay — founder, Kay's Career Solutions") and 1–2 true credential lines that you supply. This keeps the layout as it is. On phones, stack it above the paragraph. Don't use the hero, because that area was just cleaned up.

## 2. Sharing: the share image could expose résumé text, and shares don't bring people back
- PRESENT: `GradedPaperCard.tsx` "Share this roast" captures the whole card as a PNG, including the "From your résumé: “…”" quotes on strengths and notes, and the tip's "Applies to" quote.
- RISK (observation): a viral share can leak employer names, contact details or quoted lines from the résumé.
- MISSING: a site link or URL on the image, a "get yours free" line, and a link-preview image for the roast page or homepage (`og:image` is absent on `index.tsx` and `roast.tsx`; both use `twitter:card: summary`).
- PROPOSAL: a separate share-only layout (grade stamp, roast joke, site address, no quotes), a share-safety note, and one fixed absolute link-preview image for `/` and `/roast`.

## 3. Broken or wrong-brand details (quick fixes)
- `__root.tsx` line ~95: `twitter:site` is `@Lovable`. It should be removed or set to Kay's handle.
- PRESENT: footer links `/#how` and `/#services` resolve (ids live in `HowItWorks.tsx` and `Upsell.tsx`).
- `CareerHomepage.tsx`: the header says "Account sign-in isn't available yet", there are three "Coming soon" service cards, and the "In development" Career Clarity AI section stays. These are honest, but they make the site read as unfinished. PROPOSAL: shorten them or move them below the paid services.

## 4. Operational readiness and legal basics
- `src/routes/privacy.tsx`: the site says no verified business contact address has been added. That blocks data access and removal requests.
- `orders.$token.tsx`: "Please contact Kay's Career Solutions" appears, but no contact method exists anywhere.
- MISSING: Terms of Service page (no refunds, digital delivery, AI-assisted disclosure), a contact email, `sitemap.xml` (`public/` has only `robots.txt`).
- Known blockers (not re-verified): `STRIPE_WEBHOOK_SECRET` and webhook registration, the once-a-minute fulfillment schedule plus `LOVABLE_CRON_SECRET`, and the email sender domain. Without the schedule and webhook, delivery depends on the customer keeping the order page open.

## 5. Conversion: there's no proof of the paid product
- PRESENT: the roast page blurs a template preview (`TemplatePicker` in `roast.tsx`); there are pricing tiers, and the order dashboard has a recommendation.
- MISSING: before/after résumé samples, a sample $60 keyword comparison, a turnaround statement, and an "AI-assisted, built only from your facts" explainer next to pricing.
- PROPOSAL: one static "Sample before → after" block in `Upsell.tsx` built from made-up résumés, plus a short turnaround and what's-included line on each tier in `PricingTiers.tsx`.

## 6. Quality of the delivered résumé: still unproven from start to finish
- Observation from earlier turns (not re-run): no paid package has ever reached "ready" in a full run, so the Word and styled-file exports were never opened and checked against the source facts.
- PROPOSAL: a fixture run per tier through `src/lib/fulfillment` to "ready", then extract the Word file and compare roles, education, skills, certifications and photo. This is the gate before launch.

## 7. Viral loop mechanics (optional, after 1–4)
- MISSING: a referral or "roast a friend" prompt after the result, a way to re-grade after edits to show improvement, and any analytics on share or checkout funnels.
- PROPOSAL: a "Re-roast after your edits" button and a "Send to a friend" link to `/roast` on the result card. Neither needs accounts.

## Suggested order
1 (portrait/about) → 3 (quick fixes) → 2 (safe share image) → 4 (contact/terms + blockers) → 6 (delivery proof) → 5 → 7.

## Technical notes
- Files: `src/components/CareerHomepage.tsx` (CareerStatement, header notice, services), `src/components/GradedPaperCard.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/roast.tsx`, `src/routes/privacy.tsx`, `src/routes/orders.$token.tsx`, `src/components/Upsell.tsx`, `src/components/PricingTiers.tsx`, `public/`.
- None of these touch payment verification, fulfillment leasing or roast grounding.
