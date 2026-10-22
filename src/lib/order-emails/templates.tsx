/**
 * Branded order emails (React Email). Registered with the managed app-email sender once
 * the sender domain is verified; until then they are rendered only by tests.
 * Body background stays white for mail-client compatibility; navy/cyan accents match the site.
 */
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

const NAVY = "#0b1530";
const CYAN = "#2dd4d0";
const INK = "#1d2433";
const MUTED = "#5b6475";

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif", color: INK };
const container = { maxWidth: "560px", margin: "0 auto", padding: "0 0 24px" };
const band = { backgroundColor: NAVY, padding: "22px 28px", borderRadius: "10px 10px 0 0" };
const brand = { color: "#ffffff", fontSize: "18px", fontWeight: 700, margin: 0, letterSpacing: "0.02em" };
const tag = { color: CYAN, fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase" as const, margin: "4px 0 0" };
const inner = { padding: "26px 28px", border: "1px solid #e3e7ef", borderTop: "none", borderRadius: "0 0 10px 10px" };
const h1 = { fontSize: "22px", margin: "0 0 14px", color: NAVY };
const p = { fontSize: "15px", lineHeight: "24px", margin: "0 0 14px" };
const small = { fontSize: "12px", lineHeight: "19px", color: MUTED, margin: "0 0 8px" };
const button = { backgroundColor: CYAN, color: NAVY, fontWeight: 700, fontSize: "15px", padding: "12px 22px", borderRadius: "6px", textDecoration: "none" };

function Shell({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={band}>
            <Text style={brand}>Kay&apos;s Career Solutions</Text>
            <Text style={tag}>Polish · Optimize · Elevate</Text>
          </Section>
          <Section style={inner}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}

function PrivateNote({ expires }: { expires?: string | undefined }) {
  return (
    <>
      <Hr style={{ borderColor: "#e3e7ef", margin: "22px 0 14px" }} />
      <Text style={small}>This link is private to your order. Don&apos;t forward this email.{expires ? ` It expires ${expires}.` : ""}</Text>
      <Text style={small}>Didn&apos;t place this order? You can ignore this email.</Text>
    </>
  );
}

export type ConfirmationProps = { firstName?: string; packageName?: string; orderUrl?: string; expires?: string };
export function OrderConfirmationEmail({ firstName, packageName, orderUrl, expires }: ConfirmationProps) {
  return (
    <Shell preview="Payment confirmed. Your package is in progress.">
      <Heading style={h1}>Payment confirmed</Heading>
      <Text style={p}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
      <Text style={p}>
        Stripe confirmed your payment for <strong>{packageName ?? "your package"}</strong>. We&apos;re writing it from the facts you gave us, and every file is checked before release.
        We&apos;ll email you again when your files are ready. You can check progress anytime.
      </Text>
      {orderUrl && <Button href={orderUrl} style={button}>View your order</Button>}
      <PrivateNote expires={expires} />
    </Shell>
  );
}

export type ReadyProps = { firstName?: string; packageName?: string; orderUrl?: string; expires?: string; hasCoverLetter?: boolean };
export function OrderReadyEmail({ firstName, packageName, orderUrl, expires, hasCoverLetter }: ReadyProps) {
  return (
    <Shell preview="Your files are ready to download.">
      <Heading style={h1}>Your files are ready</Heading>
      <Text style={p}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
      <Text style={p}>
        Your <strong>{packageName ?? "package"}</strong> passed our accuracy checks. Open your order page to download your résumé
        {hasCoverLetter ? " and cover letter" : ""} as an editable Word file or a styled version you can print to PDF.
      </Text>
      {orderUrl && <Button href={orderUrl} style={button}>Download your files</Button>}
      <PrivateNote expires={expires} />
    </Shell>
  );
}

export type LinksProps = { orders?: Array<{ packageName: string; url: string; status: string }> };
export function OrderLinksEmail({ orders }: LinksProps) {
  const list = orders ?? [];
  return (
    <Shell preview="Your private order links.">
      <Heading style={h1}>Your order links</Heading>
      <Text style={p}>Someone asked us to resend the order links for this email address. Here they are:</Text>
      {list.map((o) => (
        <Section key={o.url} style={{ margin: "0 0 14px" }}>
          <Text style={{ ...p, margin: "0 0 6px" }}><strong>{o.packageName}</strong> · {o.status}</Text>
          <Button href={o.url} style={button}>Open order</Button>
        </Section>
      ))}
      <PrivateNote />
    </Shell>
  );
}

/** Template catalogue: names are fixed server-side; the browser can never choose one. */
export const ORDER_EMAILS = {
  "order-confirmation": { component: OrderConfirmationEmail, subject: "Payment confirmed — your package is in progress", displayName: "Order confirmation", previewData: { firstName: "Avery", packageName: "Resume Revamp", orderUrl: "https://paper-grade-roast.lovable.app/orders/sample", expires: "Nov 21, 2026" } },
  "order-ready": { component: OrderReadyEmail, subject: "Your files are ready", displayName: "Order ready", previewData: { firstName: "Avery", packageName: "Revamp + ATS Optimization", orderUrl: "https://paper-grade-roast.lovable.app/orders/sample", hasCoverLetter: true } },
  "order-links": { component: OrderLinksEmail, subject: "Your Kay's Career Solutions order links", displayName: "Order link recovery", previewData: { orders: [{ packageName: "Resume Revamp", url: "https://paper-grade-roast.lovable.app/orders/sample", status: "Ready" }] } },
} as const;

export type OrderEmailName = keyof typeof ORDER_EMAILS;
