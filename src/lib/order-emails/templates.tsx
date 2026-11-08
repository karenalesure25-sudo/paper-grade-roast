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

export type ConfirmationProps = { firstName?: string; packageName?: string; orderUrl?: string; expires?: string; hasCoverLetter?: boolean };
export function OrderConfirmationEmail({ firstName, packageName, orderUrl, expires, hasCoverLetter }: ConfirmationProps) {
  const service = packageName ?? "package";
  return (
    <Shell preview={`Thank you for your purchase — we're working on your ${service}.`}>
      <Heading style={h1}>{firstName ? `Thank you for your purchase, ${firstName}!` : "Thank you for your purchase!"}</Heading>
      <Text style={p}>
        We&apos;re working on your <strong>{service}</strong>{hasCoverLetter ? " (cover letter included)" : ""}. Your payment is confirmed, and we&apos;ll email you again as soon as your files have passed our accuracy checks and are ready to download.
      </Text>
      <Text style={p}>Delivery is within 24–48 eligible hours, Sundays excluded (Central Time), counted from your confirmed payment or from when we receive any required details, whichever is later.</Text>
      {orderUrl && <Button href={orderUrl} style={button}>Track your order</Button>}
      <PrivateNote expires={expires} />
    </Shell>
  );
}

export type ReadyProps = { firstName?: string; packageName?: string; orderUrl?: string; expires?: string; hasCoverLetter?: boolean; roastPersonality?: string };
export function OrderReadyEmail({ firstName, packageName, orderUrl, expires, hasCoverLetter, roastPersonality }: ReadyProps) {
  return (
    <Shell preview="Your files are ready to download.">
      <Heading style={h1}>Your files are ready</Heading>
      <Text style={p}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
      <Text style={p}>
        Your <strong>{packageName ?? "package"}</strong> passed our accuracy checks. Open your order page to download your résumé
        {hasCoverLetter ? " and cover letter" : ""} as an editable Word file or a styled version you can print to PDF.
      </Text>
      {roastPersonality && <Text style={p}>Your original free roast from {roastPersonality} is also saved on your private order page.</Text>}
      <Text style={small}>Your package includes one complimentary minor revision (wording, corrections or formatting within your template), requested from your order page within 7 calendar days. Errors we introduced are fixed free and don&apos;t use it.</Text>
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
export type RevisionReadyProps = ReadyProps & { version?: number };
export function RevisionReadyEmail({ firstName, packageName, orderUrl, expires, hasCoverLetter, version }: RevisionReadyProps) {
  return (
    <Shell preview="Your revised files are ready">
      <Heading style={h1}>{firstName ? `Your revision is ready, ${firstName}` : "Your revision is ready"}</Heading>
      <Text style={p}>
        Version {version ?? 2} of your {packageName ?? "package"} passed the same accuracy checks as your first delivery.
        {hasCoverLetter ? " Your cover letter was updated to match." : ""} Your original files are still on your order page.
      </Text>
      <Section style={{ margin: "8px 0 6px" }}><Button href={orderUrl ?? "#"} style={button}>Open your order page</Button></Section>
      <PrivateNote expires={expires} />
    </Shell>
  );
}

export type OwnerAlertProps = { title?: string; detail?: string; at?: string };
/** Internal owner notice. Never contains customer names, emails or résumé content. */
export function OwnerAlertEmail({ title, detail, at }: OwnerAlertProps) {
  return (
    <Shell preview="Action may be needed on your site">
      <Heading style={h1}>Site alert: {title ?? "attention needed"}</Heading>
      <Text style={p}>{detail ?? "Something needs your attention."}</Text>
      {at ? <Text style={p}>Raised: {at} (UTC)</Text> : null}
    </Shell>
  );
}

export type FollowupProps = { firstName?: string; packageName?: string; shareUrl?: string; preferencesUrl?: string; feedbackUrl?: string };
function FollowupFooter({ preferencesUrl }: { preferencesUrl?: string | undefined }) {
  return (
    <>
      <Hr style={{ borderColor: "#e3e7ef", margin: "22px 0 14px" }} />
      <Text style={small}>You&apos;re receiving this because you opted in to occasional follow-ups after your order. We send at most two.{preferencesUrl ? " " : ""}{preferencesUrl && <a href={preferencesUrl} style={{ color: MUTED }}>Change your preference or unsubscribe</a>}</Text>
    </>
  );
}
export function FollowupReviewEmail({ firstName, packageName, shareUrl, preferencesUrl, feedbackUrl }: FollowupProps) {
  return (
    <Shell preview="How did your new résumé turn out? We'd love your honest feedback.">
      <Heading style={h1}>How did we do?</Heading>
      <Text style={p}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
      <Text style={p}>A few days ago we delivered your <strong>{packageName ?? "package"}</strong>. If you have a minute, we&apos;d appreciate your honest feedback — good or bad — so we can keep improving.</Text>
      {feedbackUrl && <Button href={feedbackUrl} style={button}>Leave quick feedback</Button>}
      <Text style={{ ...p, marginTop: "18px" }}>Know someone job hunting? You&apos;re welcome to share our website{shareUrl ? `: ${shareUrl}` : "."} Totally optional.</Text>
      <FollowupFooter preferencesUrl={preferencesUrl} />
    </Shell>
  );
}
export function FollowupInterviewEmail({ firstName, shareUrl, preferencesUrl, feedbackUrl }: FollowupProps) {
  return (
    <Shell preview="Quick check-in on your job search.">
      <Heading style={h1}>Any interviews yet?</Heading>
      <Text style={p}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
      <Text style={p}>It&apos;s been about two weeks since your résumé was delivered, so we wanted to check in. If you&apos;ve landed an interview, congratulations — we&apos;d love to hear about it. If not yet, that&apos;s normal; job searches take time, and results depend on many things outside any résumé.</Text>
      {feedbackUrl && <Button href={feedbackUrl} style={button}>Tell us how it&apos;s going</Button>}
      <Text style={{ ...p, marginTop: "18px" }}>If you&apos;re applying for a different kind of role, our services are always on our website{shareUrl ? `: ${shareUrl}` : "."}</Text>
      <FollowupFooter preferencesUrl={preferencesUrl} />
    </Shell>
  );
}

export const ORDER_EMAILS = {
  "order-confirmation": { component: OrderConfirmationEmail, subject: "Thank you for your purchase — we're working on it", displayName: "Order confirmation", previewData: { firstName: "Avery", packageName: "Resume Revamp", orderUrl: "https://paper-grade-roast.lovable.app/orders/sample", expires: "Nov 21, 2026" } },
  "order-ready": { component: OrderReadyEmail, subject: "Your files are ready", displayName: "Order ready", previewData: { firstName: "Avery", packageName: "Revamp + ATS Optimization", orderUrl: "https://paper-grade-roast.lovable.app/orders/sample", hasCoverLetter: true } },
  "revision-ready": { component: RevisionReadyEmail, subject: "Your revised files are ready", displayName: "Revision ready", previewData: { firstName: "Avery", packageName: "Resume Revamp", orderUrl: "https://paper-grade-roast.lovable.app/orders/sample", version: 2 } },
  "order-links": { component: OrderLinksEmail, subject: "Your Kay's Career Solutions order links", displayName: "Order link recovery", previewData: { orders: [{ packageName: "Resume Revamp", url: "https://paper-grade-roast.lovable.app/orders/sample", status: "Ready" }] } },
  "followup-review": { component: FollowupReviewEmail, subject: "How did your new résumé turn out?", displayName: "Follow-up: feedback request (opt-in)", purpose: "commercial", previewData: { firstName: "Avery", packageName: "Resume Revamp", shareUrl: "https://paper-grade-roast.lovable.app/", preferencesUrl: "https://paper-grade-roast.lovable.app/email-preferences/sample", feedbackUrl: "https://paper-grade-roast.lovable.app/email-preferences/sample#feedback" } },
  "followup-interview": { component: FollowupInterviewEmail, subject: "Quick check-in: any interviews yet?", displayName: "Follow-up: interview check-in (opt-in)", purpose: "commercial", previewData: { firstName: "Avery", shareUrl: "https://paper-grade-roast.lovable.app/", preferencesUrl: "https://paper-grade-roast.lovable.app/email-preferences/sample", feedbackUrl: "https://paper-grade-roast.lovable.app/email-preferences/sample#feedback" } },
  "owner-alert": { component: OwnerAlertEmail, subject: "Kay's Career Solutions — site alert", displayName: "Owner alert", previewData: { title: "gateway-outage", detail: "Résumé generation is paused.", at: "2026-11-08T15:00:00Z" } },
} as const;

export type OrderEmailName = keyof typeof ORDER_EMAILS;
