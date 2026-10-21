- [x] Premium gold/red full-site redesign, responsive logo, and cross-route verification
- [x] Metallic-logo signature homepage revision and responsive cross-route verification
# Roadmap

- [x] Responsive visual audit and scoped fixes: homepage, roast, and order dashboard at 1440/1280/1024/390/360; before/after evidence, anchors, loaded logo/portrait, and browser-only template/review fixtures verified without checkout calls. Evidence: /tmp/browser/responsive-audit/. No production publish.

- [x] Scoped order questionnaire with explicit recommendations and answer carry-over (browser-verified 1280px + 390px: no résumé→Scratch, targeted job→Bundle, explicit accept, role/job text carried, answers kept on edit)
- [x] Saved-intake recovery: paid/finished orders never block new orders. Purchase layout/photo are now immutable from order creation, including concurrent insert winners; recovery restores the exact selection. Three isolated regression tests added; real paid return remains unverified (live keys only).
- [x] Strict roast rubric validation, anchored feedback and fail-closed verifier (live AI 2026-10-19: strong A, weak C, early-career B, injection C with injection flagged)
- [x] Central Time displays with DST tests; 83 tests + typecheck pass
- [x] Homepage: single Career Clarity AI preview, no hero card overlap (360/390/1280 no horizontal overflow)
- [x] Order dashboard: Service → Details → Template → Review & pay; order snapshot created only on final "Place order & pay" (browser-verified 1280 full flow, 360/390 service→details)
- [x] Roast: 100s server budget, client 130s stop, stage feedback + cancel/retry (live PDF/DOCX/text graded in 24–29s)

- [x] Customer intake forms ($40/$50/$60) + review/submit, saved to backend
- [x] Prelaunch audit: grounded roast safeguards
- [x] Roast UI: paste text input, stale-result clearing, aria-live, session clear control
- [x] Footer real anchors + privacy page
- [x] Server-side default-off gate on paid generation and truthful unpaid messaging
- [x] Product accuracy copy and disabled unsafe job-link fetching
- [x] SSRF risk removed by requiring pasted or uploaded job posting content
- [x] Accuracy tests and browser checks
- [x] Accuracy follow-up: entailment checks, independent fact-check pass, presence detection, no truncation, aria-live, $50/$60 browser checks, test-data cleanup
- [x] Stripe test-mode checkout + server-side payment verification
- [x] Stripe hosted Checkout black/gold branding, Affirm exclusion, and three-tier verification
- [x] Graphite/navy, teal and indigo visual rebrand with matching Stripe Checkout assets
- [ ] Email sender domain (blocked: user setup)
- [x] Automatic paid fulfillment: order-bound checkout, private /orders/$token status page, manual "I've paid" path retired, engine tests
- [ ] Stripe webhook + STRIPE_WEBHOOK_SECRET (confirmed missing in secure secret-name listing; GetWebhookEndpoints denied with HTTP 403, no bypass attempted). User must register https://paper-grade-roast.lovable.app/api/public/stripe-webhook for checkout.session.completed and checkout.session.async_payment_succeeded, then enter its signing secret in Project Settings → Secrets. No secure-entry approval tool is available in this session.
- [ ] Test-mode purchase/webhook delivery run (blocked: only a live restricted key is configured; no test key)
- [ ] Background sweep activation (read-only list_http_schedules confirms only active purge-expired-callback-orders, daily 03:17 UTC; no fulfillment job). Public site returns 200; unauthenticated worker POST returns 500 "Server configuration error" because managed LOVABLE_CRON_SECRET is absent. This project has no managed HTTP schedule creation credential, and publish alone cannot fix that. Requires supported managed scheduler provisioning or separately approved server-secret setup; never use the browser's publishable key to authorize privileged fulfillment. No jobs activated against real records.
- [ ] Separate test payment environment (needs isolated test backend/deployment and Stripe test key + matching test prices + test webhook secret; do not replace live credentials). No simulated paid state or customer mutation used.
- [x] Readiness/concurrency validation: 86 isolated tests pass (189 assertions); preview compiler reports build OK. Browser-only recovery responses at 1280px/390px verify the saved Classic layout remains selected and disabled after refresh, and Start a new intake opens a fresh intake; no page errors. Screenshots: /tmp/browser/purchase-lock/{desktop,mobile}_locked.png and {desktop,mobile}_new_intake.png. These are mocked recovery reads, not evidence of payment-to-delivery or real cookie restoration. No real records, payments or emails were touched.
- [ ] Activation sequence: obtain Stripe resource access (workspace admin), register/verify live webhook, securely save signing secret, provision matching server-only cron credential and authenticated schedule while paused, then request publication/update of the verified version; only after publication verify unauthorized requests are rejected and activate processing with explicit authorization. Current production runtime readiness remains blocked. Email sender is unconfigured; private links remain the delivery channel.
