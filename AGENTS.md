<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Free roast grades must pass deterministic grounding checks and an independent model fact-check (fail-closed) before display; overlong text is rejected, never truncated — prevents unbacked or partial grades.
- Roast personalities only style an already-verified assessment; never pass the persona to the existing assessor or paid document writer. Verify every styled section independently and freeze only a server-signed original roast in the order snapshot; retries/recovery must never substitute the device's latest preference.
- Shared brand chrome lives in SiteHeader, SiteFooter, and BrandLogo; keep route business logic independent from presentation so redesigns cannot weaken safeguards.
- Shared full-logo branding uses the customer's exact, unmodified public/brand/kcs-logo-original.jpeg through BrandLogo. Preserve the complete image, background, and aspect ratio; do not crop, redraw, filter, or re-encode it. The existing emblem remains for favicon/icon scale.

- Paid deliverables require server-side Stripe Checkout Session verification (paid, tier, USD amount, email) plus a one-time redemption row in payment_redemptions — the browser can never unlock delivery.
- Paid delivery runs only through src/lib/fulfillment (order snapshot before checkout, Stripe-verified, lease-claimed processing); never reintroduce browser-triggered generation — the browser can't be trusted to prove payment.
- Order recovery uses expiring HttpOnly same-site capability cookies and immutable server snapshots; never put customer answers or photos in browser storage, because device storage is readable by client scripts.
- Purchase layout/photo are immutable from initial order insertion, including unpaid orders; recovery returns that exact selection because an open Checkout Session can be paid concurrently and a replacement snapshot would misrepresent the purchase.
- Service recommendations are pure rules independent of roast grades and require explicit selection, because a recommendation must never silently change a purchase.
- Customer timestamps use the shared America/Chicago Intl formatter while persisted timestamps remain UTC, because daylight saving offsets vary.

- Size template picker columns by their own container, and show the three-column order dashboard only at xl; nested workspace width, not viewport width, determines usable preview sizes.
- The fulfillment worker route authenticates with a token held only in the database `private` schema (checked by the service-role-only `verify_worker_token`) or a managed cron secret; never the publishable key, because `/api/public/*` is reachable by anyone.
- Customer order emails go through src/lib/fulfillment/notify.ts with an injected EmailPort and per-order fenced claims (unique claim token required to finish) and backoff state in `fulfillment_orders.notifications`; recovery admission is one atomic DB call that fails closed; success is recorded only after an accepted send, and email-sent links always use PUBLIC_SITE_ORIGIN (never request headers).
- Lost-link recovery returns one generic response, rate-limits by hashed email/IP, and emails only the address on file — prevents order enumeration.
- Share images are built from the letter grade only (src/lib/share-card.ts); never include roast text or résumé quotes in shareable output.
- Post-delivery revisions live in src/lib/fulfillment/revision.ts + `order_revisions`: reservation and retry are row-locked RPCs that fix the base (latest ready version) on the row, stale settle is fenced on lease id + expiry in SQL, processing is lease-fenced, the included revision is consumed only by a ready `minor` row, and each revision edits its base package but is validated against ORIGINAL source facts plus deterministic and independent scope checks (request text is untrusted); prior versions are never overwritten. Download authorization lives in src/lib/fulfillment/order-file.ts with injected lookups so it stays route-testable.
- Service windows (delivery/revision deadlines, Sunday exclusion, revision window end) come only from src/lib/fulfillment/service-time.ts in America/Chicago; SQL `minor_revision_window_end` must stay identical to its TS mirror.
- Generation outages use one DB circuit breaker (`ops_state` + `ai_breaker_*` RPCs, logic in src/lib/ops/guard.ts): account-level gateway errors (402 / limit 403 / 401) open it, free roasts and the paid worker stop calling while open, paid orders get their attempt back and requeue, and after a cooldown exactly one real request owns a DB probe token (acquired only right before a real call) and only that token's success may close it — other 200s never touch the breaker; every model call (writer, checker, triage, scope reviewer) trips it itself and outages are rethrown, never turned into validation rejections. There is no no-cost credit API, so never poll paid models to check health.
- Checkout (new and resumed) fails closed via `checkoutAvailability` when the breaker is open, the gateway key is missing, or the authenticated worker heartbeat is stale; unpaid open sessions are expired, paid/complete sessions are never touched.
- Owner alerts: per-incident keys raised once by a persistent worker failure scan (orders, revisions, settled stale leases); delivery idempotency uses the alert's stable incident id; the worker heartbeat is written only after a completed sweep.
- Owner alerts go only to server-configured `OWNER_ALERT_EMAIL` (never customer data) through the existing email port, deduped per key with fenced claims/backoff in `ops_state`, and contain no customer PII.
- Post-delivery follow-ups (src/lib/fulfillment/followups.ts) are commercial email: explicit default-off per-order opt-in, live mode only, separate `pref_token` for preferences/unsubscribe (never the order access token or private links), sent only through `marketingEmailPort` — never the transactional app-email sender — because mislabeling marketing as transactional breaks compliance and deliverability.
