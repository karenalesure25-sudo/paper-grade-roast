/** Minimal Stripe REST client (fetch-based, Worker-safe). Server-only. */
import type { TierId } from "./products";

const API = "https://api.stripe.com/v1";

/** Server-owned prices. The browser never sends an amount. */
export const TIER_PRICING: Record<TierId, { cents: number; name: string; priceId?: string }> = {
  revamp: { cents: 4000, name: "Resume Revamp", priceId: "price_1UN1qPB29VijguUHaAc8Qh3g" },
  scratch: { cents: 5000, name: "Résumé From Scratch", priceId: "price_1UN1qeB29VijguUHUytddPr8" },
  bundle: { cents: 6000, name: "Revamp + ATS Optimization", priceId: "price_1UN1s2B29VijguUHtaQMBeu7" },
};

function key(): string {
  const k = process.env["STRIPE_SECRET_KEY"];
  if (!k) throw new Error("Checkout isn't configured.");
  return k;
}

async function stripe<T>(path: string, init?: { method?: string; form?: URLSearchParams }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key()}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(init?.form ? { body: init.form.toString() } : {}),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Stripe request failed [${res.status}] ${path}`);
    throw new Error("The payment service didn't respond. Try again in a moment.");
  }
  return JSON.parse(body) as T;
}

export type StripeSession = {
  id: string;
  url: string | null;
  mode: string;
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  livemode: boolean;
  branding_settings?: {
    background_color?: string | null;
    border_style?: string | null;
    button_color?: string | null;
    display_name?: string | null;
    font_family?: string | null;
    icon?: { file?: string | null; type?: string | null } | null;
    logo?: { file?: string | null; type?: string | null } | null;
  } | null;
  excluded_payment_method_types?: string[] | null;
  expires_at?: number;
  currency_conversion?: { amount_total: number; source_currency: string } | null;
  metadata: Record<string, string> | null;
};

export async function createCheckoutSession(opts: {
  tier: TierId;
  email: string;
  origin: string;
}): Promise<StripeSession> {
  const p = TIER_PRICING[opts.tier];
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("customer_email", opts.email);
  f.set("line_items[0][quantity]", "1");
  if (p.priceId) {
    f.set("line_items[0][price]", p.priceId);
  } else {
    f.set("line_items[0][price_data][currency]", "usd");
    f.set("line_items[0][price_data][unit_amount]", String(p.cents));
    f.set("line_items[0][price_data][product_data][name]", p.name);
  }
  f.set("metadata[tier]", opts.tier);
  f.set("metadata[email]", opts.email.toLowerCase());
  // Per-session branding override (Stripe File IDs for the Kay's logo/icon).
  f.set("branding_settings[display_name]", "Kay's Career Solutions");
  f.set("branding_settings[logo][type]", "file");
  f.set("branding_settings[logo][file]", "file_1UN3GeB29VijguUHS6dc8l0y");
  f.set("branding_settings[icon][type]", "file");
  f.set("branding_settings[icon][file]", "file_1UN3I5B29VijguUH6KlBDRBp");
  // Match the site's graphite, cyan and indigo system within hosted Checkout controls.
  f.set("branding_settings[background_color]", "#080D1B");
  f.set("branding_settings[button_color]", "#2DD4D0");
  f.set("branding_settings[border_style]", "rectangular");
  f.set("branding_settings[font_family]", "inter");
  // Keep Stripe's dynamic payment methods, excluding only Affirm for this project.
  f.append("excluded_payment_method_types[]", "affirm");
  f.set("success_url", `${opts.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`);
  f.set("cancel_url", `${opts.origin}/payment-canceled`);
  return stripe<StripeSession>("/checkout/sessions", { method: "POST", form: f });
}

export async function getCheckoutSession(id: string): Promise<StripeSession> {
  return stripe<StripeSession>(`/checkout/sessions/${encodeURIComponent(id)}`);
}

export async function expireCheckoutSession(id: string): Promise<StripeSession> {
  return stripe<StripeSession>(`/checkout/sessions/${encodeURIComponent(id)}/expire`, {
    method: "POST",
    form: new URLSearchParams(),
  });
}
