# Isolated Stripe test-mode checkout (audit + what to build)

## Audit findings (read-only, verified this turn)
- Saved settings present: live payment key, live webhook signing secret, test payment key. No test webhook signing secret saved. Scheduled-worker secret not present.
- Test mode is **not implemented**. Only the live key is ever read (`stripe.server.ts`). The test key is unused.
- Only one webhook endpoint exists: `/api/public/stripe-webhook`, verified with the live secret only. **There is no test webhook URL to configure yet** — do not register one in Stripe until it is built.
- Orders, payment records and Stripe event rows have no mode/livemode column. A test and live order are indistinguishable in the database.
- Payment rereads (`getCheckoutSession`) always call Stripe with the live key, so a test session could not even be verified today — it fails closed, but also cannot be tested.
- Price IDs in code are live prices; test mode needs its own test prices (or inline USD amounts).
- Email sending stays disabled (no verified domain), and the worker cron is paused. Not end-to-end ready.

## Proposed minimal isolation
1. **Mode stamped at order creation.** Add `stripe_mode` (`live` | `test`, default `live`, immutable) to fulfillment orders, payment redemptions and Stripe event rows. Test checkout only starts on the preview host or behind a server-only allow flag; production never creates test orders.
2. **Mode-selected Stripe client.** `stripe.server.ts` picks the key from the order's stored mode: live uses the existing live key, test uses the test key. Production keys are never overwritten. Test uses inline USD amounts (no live price IDs).
3. **Separate test webhook route** `/api/public/stripe-webhook-test`, verified only with a new `STRIPE_TEST_WEBHOOK_SECRET`. Each route rejects events whose `livemode` doesn't match, and rejects sessions whose order mode differs.
4. **Payment verification checks mode.** The payment gate re-reads the session with the order's own key and requires `session.livemode` to equal the order mode — a test payment can never unlock a live order, and vice versa.
5. **Fulfillment/email.** Test orders run through the same pipeline, labeled "TEST" on the order page; emails go to a capture/log adapter only, never the real sender. Test orders excluded from any live reporting and purged on the normal schedule.
6. **Tests:** cross-mode rejection (test event on live route, test session on live order, live session on test order), signature per secret, test order cannot reach live email transport.

## After implementation (your steps)
- In Stripe **Test mode**, add destination `https://project--656b31d5-ed91-45d2-b4a8-5acb422e4204-dev.lovable.app/api/public/stripe-webhook-test` (preview) with `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then save its signing secret as `STRIPE_TEST_WEBHOOK_SECRET`.
- Run a test card checkout on the preview; I verify the order reaches ready with a test-labeled package.

## Still pending (not end-to-end ready)
- Domain + verified email sender; real emails stay off.
- Worker activation and publish authorization (preview test runs need the worker nudged manually or via the order page).
- Confirm the live webhook is delivering successfully once published.

## Technical notes
- Migration: add `stripe_mode text not null default 'live' check (in ('live','test'))` with immutability in existing triggers.
- `createCheckoutSession/getCheckoutSession(mode, …)`; `verifyPayment` adds `s.livemode === (mode==='live')`.
- `handleStripeEvent(evt, mode)` asserts `evt.livemode` and order mode before claiming.
- Test checkout gate: server checks request host is the preview host and `STRIPE_TEST_SECRET_KEY` exists.
