import { z } from "zod";
import { DeliveredRoastSchema, type DeliveredRoast } from "./roast-delivery";
import type { PersonaId } from "./roast-personas";

export const ROAST_OWNER_COOKIE = "kcs-roast-owner";
const TTL = 24 * 60 * 60 * 1000;
const PURPOSE = "kcs-verified-original-roast-v1";
const ReceiptSchema = z.object({ purpose: z.literal(PURPOSE), owner: z.string().regex(/^[a-f0-9]{64}$/), expires: z.number(), roast: DeliveredRoastSchema }).strict();
const bytes = (s: string) => new TextEncoder().encode(s);

export function newRoastOwner() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function signingKey(secret: string) {
  // Domain-separated derivative: the existing server-only key never leaves the server.
  const root = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const derived = await crypto.subtle.sign("HMAC", root, bytes(PURPOSE));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function serverSecret() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("The roast couldn’t be saved for checkout. Please try again later.");
  return key;
}

export async function issueRoastReceipt(roast: DeliveredRoast, owner: string, secret = serverSecret(), now = Date.now()): Promise<string> {
  const payload = ReceiptSchema.parse({ purpose: PURPOSE, owner, expires: now + TTL, roast });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), bytes(body));
  return `${body}.${Buffer.from(signature).toString("base64url")}`;
}

/** Never trust browser-supplied grades/prose. Only our signed, same-session, unexpired result may enter an order. */
export async function verifyRoastReceipt(receipt: string, owner: string | undefined, persona: PersonaId | undefined, secret = serverSecret(), now = Date.now()): Promise<DeliveredRoast> {
  const invalid = () => new Error("Your saved roast couldn’t be verified. Generate a fresh roast, or remove it from this order and continue.");
  if (!owner || !persona || receipt.length > 32_000) throw invalid();
  const parts = receipt.split(".");
  if (parts.length !== 2 || !parts.every((s) => /^[A-Za-z0-9_-]+$/.test(s))) throw invalid();
  const [body, signature] = parts as [string, string];
  try {
    if (!(await crypto.subtle.verify("HMAC", await signingKey(secret), Buffer.from(signature, "base64url"), bytes(body)))) throw invalid();
    const payload = ReceiptSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (payload.owner !== owner || payload.expires <= now || payload.roast.persona !== persona) throw invalid();
    return payload.roast;
  } catch { throw invalid(); }
}
