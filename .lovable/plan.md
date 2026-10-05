# Stripe Checkout visual update

## What will change
- Update only the shared Stripe Checkout session request used by all three résumé services.
- Keep the existing Kay’s display name, uploaded logo/icon, live account, and saved $40/$50/$60 price IDs.
- Apply Stripe-supported dark branding based on the site tokens: black background, gold accent/button with readable dark text, and the closest supported serif font.
- Exclude Affirm through Stripe’s session-level payment-method exclusion setting while leaving every other dynamically enabled payment method untouched.

## Validation
- Confirm the existing server-side paid-session and one-time redemption checks remain unchanged.
- Validate the app build.
- Create one new unpaid Checkout Session for each service and inspect the returned session data for live price, branding, and Affirm exclusion.
- Visually inspect hosted Checkout on desktop and mobile for all three tiers, including logo, contrast, amount, and payment methods.
- Expire all three verification sessions and read them back to confirm `status: expired`.
- Do not charge a card, create products or prices, change the Stripe connection, publish, or modify the website layout.

## Technical details
- Changes stay in the Worker-compatible Stripe REST helper.
- Verification sessions will use the existing live prices and a non-customer test email solely to open unpaid hosted Checkout pages.
- No credentials or customer information will be logged or returned.
