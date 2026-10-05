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
- Shared branding uses the native ribbon-K SVG emblem and responsive SVG lockup; use the emblem alone at favicon/icon scale so lettering stays legible.

- Paid deliverables require server-side Stripe Checkout Session verification (paid, tier, USD amount, email) plus a one-time redemption row in payment_redemptions — the browser can never unlock delivery.
