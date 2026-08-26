type ConfirmationInput = {
  orderId: string;
  email: string;
  tier: string;
  name: string;
  resumeUrl: string;
  coverLetterUrl?: string;
  expiresAt: string;
};

/**
 * Sends the order confirmation email with the expiring download links.
 * Wired up to the project's email templates once the sender domain is configured.
 */
export async function sendOrderConfirmation(input: ConfirmationInput): Promise<boolean> {
  console.log("order ready for confirmation email", {
    orderId: input.orderId,
    tier: input.tier,
    hasCoverLetter: Boolean(input.coverLetterUrl),
  });
  return false;
}
