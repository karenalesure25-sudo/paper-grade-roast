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
- Shared brand chrome lives in SiteHeader, SiteFooter, and BrandLogo; keep route business logic independent from presentation so redesigns cannot weaken safeguards.
- Shared full-logo branding uses the customer's exact, unmodified public/brand/kcs-logo-original.jpeg through BrandLogo. Preserve the complete image, background, and aspect ratio; do not crop, redraw, filter, or re-encode it. The existing emblem remains for favicon/icon scale.

- Paid deliverables require server-side Stripe Checkout Session verification (paid, tier, USD amount, email) plus a one-time redemption row in payment_redemptions — the browser can never unlock delivery.
- Paid delivery runs only through src/lib/fulfillment (order snapshot before checkout, Stripe-verified, lease-claimed processing); never reintroduce browser-triggered generation — the browser can't be trusted to prove payment.
- Order recovery uses expiring HttpOnly same-site capability cookies and immutable server snapshots; never put customer answers or photos in browser storage, because device storage is readable by client scripts.
- Purchase layout/photo are immutable from initial order insertion, including unpaid orders; recovery returns that exact selection because an open Checkout Session can be paid concurrently and a replacement snapshot would misrepresent the purchase.
- Service recommendations are pure rules independent of roast grades and require explicit selection, because a recommendation must never silently change a purchase.
- Customer timestamps use the shared America/Chicago Intl formatter while persisted timestamps remain UTC, because daylight saving offsets vary.
