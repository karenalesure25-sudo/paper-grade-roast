import { getRequest } from "@tanstack/react-start/server";
import { saveOrderRecord } from "./order-store.server";
import type { ResumeData } from "./resume-templates";
import type { AtsReport } from "./order.server";

type DeliverInput = {
  email: string;
  tier: string;
  template: string;
  sourceLabel?: string;
  jobLabel?: string;
  resume: ResumeData;
  coverLetter?: string;
  atsReport?: AtsReport;
};

export type Delivery = {
  resumeUrl?: string;
  coverLetterUrl?: string;
  expiresAt?: string;
  emailed: boolean;
};

function siteOrigin(): string {
  try {
    const request = getRequest();
    const url = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    return `${proto}://${forwardedHost ?? url.host}`;
  } catch {
    return "";
  }
}

/**
 * Stores the finished deliverables, mints expiring download links, and sends the
 * order confirmation email. A failed email never fails the order — the buyer
 * still gets the links on screen.
 */
export async function deliverOrder(input: DeliverInput): Promise<Delivery> {
  const saved = await saveOrderRecord(input);
  const origin = siteOrigin();

  const resumeUrl = `${origin}/api/public/download/${saved.resumeToken}`;
  const coverLetterUrl = input.coverLetter
    ? `${origin}/api/public/download/${saved.letterToken}`
    : undefined;

  let emailed = false;
  try {
    const { sendOrderConfirmation } = await import("./order-mailer.server");
    emailed = await sendOrderConfirmation({
      orderId: saved.id,
      email: saved.email,
      tier: input.tier,
      name: input.resume.name,
      resumeUrl,
      ...(coverLetterUrl ? { coverLetterUrl } : {}),
      expiresAt: saved.expiresAt,
    });
  } catch (cause) {
    console.error("order confirmation email failed", cause);
  }

  return {
    resumeUrl,
    ...(coverLetterUrl ? { coverLetterUrl } : {}),
    expiresAt: saved.expiresAt,
    emailed,
  };
}
