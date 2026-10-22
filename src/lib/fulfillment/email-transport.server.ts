/**
 * Production email port. Delivery is OFF until a sender domain the business owns is verified
 * and the managed app-email sender is scaffolded. Activation (one change):
 *   1. Set up the email domain, then scaffold app-email templates.
 *   2. Register ORDER_EMAILS (src/lib/order-emails/templates.tsx) in the generated registry.
 *   3. Replace `available` / `send` below with a call to the generated sendTemplateEmail helper,
 *      mapping { sent: false, reason: 'recipient_suppressed' } → suppressed, EmailAPIError 429/5xx → retry
 *      (with retryAfterSeconds), domain_not_verified / emails_disabled → unconfigured, other → permanent.
 * Until then nothing is claimed or marked sent, so no attempts are consumed and the UI stays truthful.
 */
import type { EmailPort } from "./notify";

export const EMAIL_DELIVERY_ACTIVE = false;

export const productionEmailPort: EmailPort = {
  available: () => EMAIL_DELIVERY_ACTIVE,
  async send() {
    return { status: "unconfigured" };
  },
};
