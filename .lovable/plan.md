# Launch readiness: findings and remaining steps

Short answer: the backend is **not ready** to take paid orders without you watching it. Buying a domain **by itself will not** turn on automatic email delivery. Email sending code still has to be built after the domain is set up.

## What I checked (read-only, 22 Oct 2026)

| Item | Status | Evidence |
|---|---|---|
| Stripe secret key | Verified present | Secrets list (value not shown) |
| STRIPE_WEBHOOK_SECRET | **Missing** | Not in secrets list. Webhook route returns 503 "not configured" |
| Stripe webhook registered in Stripe | **Inaccessible** | Stripe tool returned access denied (403) |
| LOVABLE_CRON_SECRET | **Missing** | Not in secrets list. The fulfillment-tick route rejects every call with 500 |
| Fulfillment scheduler | **Missing** | Only one scheduled job exists: `purge-expired-callback-orders` (daily). No job calls fulfillment-tick |
| Email sender domain | **Missing** | Email setup: not_started, no domain configured |
| Email delivery code | **Stub only** | `sendOrderConfirmation` only writes a log line and returns false. Paid orders are hard-coded `emailed: false`. No email templates exist |
| Order page copy | Code-only | Tells buyers "Email delivery isn't set up yet… this private link is how you reach your files" |
| Paid fulfillment logic | Code-only (unit tests) | engine/writer/purchase-selection tests exist. These are logic tests, not proof that live payments work |
| Full paid package, start to finish | **Not verified** | No test-mode Stripe keys. No order has ever reached "ready" with files I checked |

## What happens today if someone pays
Payment happens on Stripe. There's no webhook secret and no scheduler, so the order only moves forward when the buyer stays on, or comes back to, their private order page. That page re-checks Stripe and starts the writing. Nothing gets emailed. If the buyer closes the tab and loses the link, the order stalls.

## Remaining steps, in priority order
1. **Webhook secret (you):** In Stripe, open the webhook endpoint `https://paper-grade-roast.lovable.app/api/public/stripe-webhook` (create it if needed). Choose events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its signing secret into Project Settings → Secrets as `STRIPE_WEBHOOK_SECRET`. I can't see Stripe from here, so I can't confirm the endpoint exists.
2. **Background worker (me, after approval):** Create the cron secret and a once-a-minute schedule that calls fulfillment-tick, so orders finish even after the buyer leaves.
3. **Email (both of us):** Buy or connect a domain, then complete "Set up email domain". After that I build the order-ready email: a branded template with the private order link, sent once per order from the server after files are ready, plus updated order-page wording. Emails start going out only after the domain's DNS is verified.
4. **Real end-to-end proof (both of us):** Add Stripe test-mode keys, or approve one small live purchase you refund yourself in Stripe. Then I run one order per tier ($40/$50/$60) through to downloaded Word and styled files and the received email, and check the content against the source résumé.
5. Publish only after steps 1–4 pass.

## 3–5 highest-value launch improvements (no redesign)
1. **Contact and Terms pages**, plus a sitemap. Paid services need a visible support contact and terms that match the no-refunds rule.
2. **Fix leftover "Lovable" social metadata and "coming soon" copy**, so shared links and pages look finished.
3. **Safer roast share card**: leave out quoted résumé text and add the site link, so every share brings people back.
4. **Sample deliverables section**: one before/after example per tier, to build trust before checkout.
5. **"Lost your order link?" recovery by email**, available once email is live. It cuts down support requests.

## Technical notes
- Cron route uses `authenticateCronRequest` (needs `LOVABLE_CRON_SECRET`). The new schedule must use a managed cron credential, not the publishable key.
- Email wiring: scaffold the app-email templates, replace the `order-mailer.server.ts` stub, call it from the fulfillment engine when an order becomes ready, use idempotency key `order-ready-<orderId>`, and set `emailed` from the actual result.
