/**
 * Production email port backed by Lovable's managed app-email API (@lovable.dev/email-js).
 *
 * Delivery stays OFF until server config names a verified sender domain the business owns:
 *   EMAIL_SENDER_DOMAIN  — delegated sending subdomain (e.g. notify.<owned-domain>); unset ⇒ disabled
 *   EMAIL_FROM_DOMAIN    — optional visible From domain (defaults to EMAIL_SENDER_DOMAIN)
 *   LOVABLE_API_KEY      — managed key
 * No domain is hardcoded. While disabled nothing is claimed or marked sent.
 */
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { render } from "@react-email/render";
import { createElement } from "react";
import { ORDER_EMAILS } from "../order-emails/templates";
import { SITE_NAME } from "../site";
import type { EmailMessage, EmailPort, EmailResult } from "./notify";

type Env = { senderDomain?: string; fromDomain?: string; apiKey?: string };
type Sender = typeof sendLovableEmail;

const VALID_DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function mapEmailError(e: unknown): EmailResult {
  if (e instanceof EmailAPIError) {
    const code = e.code ?? `http_${e.status}`;
    if (/suppress/i.test(code)) return { status: "suppressed" };
    if (code === "domain_not_verified" || code === "emails_disabled") return { status: "unconfigured" };
    if (e.status === 429 || e.status >= 500) return { status: "retry", code, retryAfterSeconds: e.status === 429 ? (e.retryAfterSeconds ?? 60) : e.retryAfterSeconds };
    return { status: "permanent", code };
  }
  return { status: "retry", code: "network" };
}

export function createLovableEmailPort(env: () => Env, send: Sender = sendLovableEmail): EmailPort {
  const config = () => {
    const { senderDomain, fromDomain, apiKey } = env();
    if (!apiKey || !senderDomain || !VALID_DOMAIN.test(senderDomain)) return null;
    const from = fromDomain && VALID_DOMAIN.test(fromDomain) ? fromDomain : senderDomain;
    return { senderDomain, from, apiKey };
  };
  return {
    available: () => config() !== null,
    async send(msg: EmailMessage): Promise<EmailResult> {
      const c = config();
      if (!c) return { status: "unconfigured" };
      const entry = ORDER_EMAILS[msg.template];
      if (!entry) return { status: "permanent", code: "unknown_template" };
      const el = createElement(entry.component as never, msg.data as never);
      const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
      try {
        const res = await send({
          to: msg.to, from: { name: SITE_NAME, address: `noreply@${c.from}` }, sender_domain: c.senderDomain,
          subject: entry.subject, html, text, purpose: "transactional", label: msg.template, idempotency_key: msg.idempotencyKey,
        }, { apiKey: c.apiKey, idempotencyKey: msg.idempotencyKey });
        if (res.success) return { status: "sent" };
        if (res.status && /suppress/i.test(res.status)) return { status: "suppressed" };
        return { status: "retry", code: res.status ?? "not_accepted" };
      } catch (e) {
        return mapEmailError(e);
      }
    },
  };
}

export const productionEmailPort: EmailPort = createLovableEmailPort(() => ({
  senderDomain: process.env["EMAIL_SENDER_DOMAIN"],
  fromDomain: process.env["EMAIL_FROM_DOMAIN"],
  apiKey: process.env["LOVABLE_API_KEY"],
}));
