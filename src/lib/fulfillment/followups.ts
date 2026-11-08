/**
 * Optional post-delivery follow-ups. These are COMMERCIAL (non-transactional) emails:
 * they require explicit opt-in (default off), honor unsubscribe, are live-mode only,
 * and must never contain the private order link. Pure logic; I/O is injected elsewhere.
 */
import type { OrderRow } from "./engine";

/** ONE combined check-in (feedback, optional sharing of the public site, interview progress). No reminders. */
export type FollowupKind = "followup:checkin";
export const FOLLOWUP_KINDS: FollowupKind[] = ["followup:checkin"];
/** Days after actual first delivery (within the owner's 10–14 day window). */
export const FOLLOWUP_DELAY_DAYS: Record<FollowupKind, number> = { "followup:checkin": 12 };

export type FollowupOrder = OrderRow & {
  followup_opt_in?: boolean | null;
  followup_unsubscribed_at?: string | null;
  pref_token?: string | null;
  stripe_mode?: string | null;
};

export function isFollowupKind(kind: string): kind is FollowupKind {
  return (FOLLOWUP_KINDS as string[]).includes(kind);
}

export function followupEligible(order: FollowupOrder, kind: FollowupKind, now = new Date()): boolean {
  if ((order.stripe_mode ?? "live") !== "live") return false;
  if (!order.paid_at || order.status !== "ready" || !order.result || !order.delivered_at) return false;
  if (order.followup_opt_in !== true || order.followup_unsubscribed_at) return false;
  if (!order.pref_token) return false;
  if (order.expires_at && new Date(order.expires_at).getTime() <= now.getTime()) return false;
  const due = new Date(order.delivered_at).getTime() + FOLLOWUP_DELAY_DAYS[kind] * 86_400_000;
  return now.getTime() >= due;
}

/** Public URLs only. The preference link uses a separate token that can't open the order or files. */
export function followupLinks(order: FollowupOrder, origin: string) {
  return {
    shareUrl: `${origin}/`,
    preferencesUrl: `${origin}/email-preferences/${order.pref_token}`,
    feedbackUrl: `${origin}/email-preferences/${order.pref_token}#feedback`,
  };
}
