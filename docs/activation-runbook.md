# Fulfillment activation runbook (no secrets here)

Do these in order. Stop at any failed check.

1. Sender email: set up a verified sender domain (More → Emails). Confirm status `active`.
2. Stripe test webhook: in Stripe Test mode, add endpoint
   `https://project--656b31d5-ed91-45d2-b4a8-5acb422e4204-dev.lovable.app/api/public/stripe-webhook-test`
   (events `checkout.session.completed`, `checkout.session.async_payment_succeeded`), save its signing secret as `STRIPE_TEST_WEBHOOK_SECRET`.
3. Run one preview test checkout with Stripe test card 4242…; confirm the order page shows Paid → In progress → Ready and the confirmation/ready emails are skipped (test orders never email).
4. Get publish approval and publish so the live worker route runs current code.
5. Call the worker route once with the database-held worker token; confirm HTTP 200 and a fresh heartbeat in `ops_state`.
6. Resume the paused `kcs-fulfillment-sweep` job (`cron.alter_job(<jobid>, active := true)`), then confirm a recorded run and heartbeat within 5 minutes.
7. Only then expect checkout to open on the published site (it fails closed while the heartbeat is stale).

Follow-up check-ins stay off until a separate marketing email provider is connected; the app-email sender may not send them.
