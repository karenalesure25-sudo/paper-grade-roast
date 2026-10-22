import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled background sweep. Callers must present the worker token held only in the
 * database's private schema (read by the scheduler at call time) or the managed cron
 * secret when one is provisioned. Claim-guarded and idempotent; returns counts only.
 */
async function authorized(request: Request): Promise<Response | null> {
  const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("verify_worker_token" as never, { _name: "fulfillment", _token: token } as never);
    if (!error && data === true) return null;
  }
  if (process.env["LOVABLE_CRON_SECRET"]) {
    const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
    return authenticateCronRequest(request);
  }
  return new Response("Unauthorized", { status: 401 });
}

export const Route = createFileRoute("/api/public/fulfillment-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authorized(request);
        if (denied) return denied;
        const { sweep } = await import("@/lib/fulfillment/service.server");
        const r = await sweep(2);
        return Response.json({ confirmed: r.confirmed, processed: r.processed.length, emails: r.emails.length });
      },
    },
  },
});
