- [x] Premium gold/red full-site redesign, responsive logo, and cross-route verification
- [x] Metallic-logo signature homepage revision and responsive cross-route verification
# Roadmap

- [x] Scoped order questionnaire with explicit recommendations and answer carry-over (browser-verified 1280px + 390px: no résumé→Scratch, targeted job→Bundle, explicit accept, role/job text carried, answers kept on edit)
- [x] Saved-intake recovery: paid/finished orders never block new orders. Purchase layout/photo are now immutable from order creation, including concurrent insert winners; recovery restores the exact selection. Three isolated regression tests added; real paid return remains unverified (live keys only).
- [x] Strict roast rubric validation, anchored feedback and fail-closed verifier (live AI 2026-10-19: strong A, weak C, early-career B, injection C with injection flagged)
- [x] Central Time displays with DST tests; 83 tests + typecheck pass

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
