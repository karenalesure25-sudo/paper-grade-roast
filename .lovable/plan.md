# Premium Gold & Red Redesign

## Goal
Rebuild the full Kay’s Career Solutions experience around the supplied gold/red brand board: elegant, credible, restrained, and easy to use on phone and desktop. Preserve every current service, intake, grading safeguard, privacy disclosure, and unpaid server gate.

## What will change
- Create a crisp responsive Kay’s logo system inspired by the supplied primary lockup: folded résumé/check icon, gold serif name, ivory descriptor, red sweep, and the existing “Polish · Optimize · Elevate” tagline. Use a compact version in the header/footer and derive the favicon from the icon.
- Replace the current centered logo-only header with a compact desktop navigation and accessible mobile menu: Free Roast, Services, How It Works, plus a strong free-roast action.
- Redesign the homepage with the requested headline, clear résumé-specific feedback copy, dual actions, a polished illustrative résumé/feedback visual, a distinct free-tool section, the exact three services and prices, a clearer process, and an accurate FAQ.
- Apply the same visual system to the roast form/result, all three intake flows, template selection, photo cropper, unpaid checkout state, completed-result presentation, privacy page, errors, loading states, and footer.
- Tighten spacing and mobile layouts while retaining accessible pink-red text for notes/errors and brand crimson for action backgrounds.

## Technical details
- Keep the current route and server behavior intact; edits stay focused on presentation and navigation.
- Build the logo as lightweight native SVG/React rather than embedding the full uploaded brand board.
- Use semantic design tokens in the global stylesheet, a restrained gold metallic treatment, clear keyboard focus, 44px touch targets, and reduced-motion support.
- Keep the payment gate server-controlled and off. No payments, emails, publishing, testimonials, guarantees, employer claims, or new service categories.
- Update each page’s metadata only where the redesigned page copy requires it.

## Verification
- Run the existing Bun test suite, TypeScript check, and preview build checks.
- Exercise homepage navigation, free roast inputs/results, each service intake through the unpaid gate, template selection, privacy, and mobile navigation.
- Inspect screenshots at desktop, 768px, 390px, and 375px for clipping, overflow, readability, and visual consistency.
- Remove only synthetic records or files created during this verification.
