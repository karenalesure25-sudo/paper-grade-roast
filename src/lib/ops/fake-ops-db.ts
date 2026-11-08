/**
 * Test-only in-memory stand-in for the ops RPCs (mirrors migrations 0008/0009 semantics; the real SQL is
 * covered by ops-fencing.check.sql). Injected explicitly per test file via __setOpsDbForTests — never global.
 */
import { __setOpsDbForTests, __setOwnerSenderForTests, type OpsDb } from "./ops.server";
import type { AlertSend, SessionPort, UnpaidSession } from "./guard";

type Row = Record<string, unknown>;
const uuid = () => crypto.randomUUID();

export class FakeOpsDb implements OpsDb {
  state = new Map<string, Row>();
  calls: string[] = [];
  now = () => Date.now();
  unpaid: UnpaidSession[] = [];
  failRpc = new Set<string>();

  private ts(v: unknown) { return typeof v === "string" ? Date.parse(v) : -Infinity; }
  private iso(ms: number) { return new Date(ms).toISOString(); }

  breaker() { return this.state.get("ai_breaker") ?? null; }
  /** Test helper: make the cooldown elapse. */
  elapseCooldown() { const b = this.breaker(); if (b) b["retryAt"] = this.iso(this.now() - 1000); }

  async rpc(fn: string, a: Record<string, unknown> = {}) {
    this.calls.push(fn);
    if (this.failRpc.has(fn)) return { data: null, error: { message: "fail" } };
    const now = this.now();
    const b = this.breaker();
    switch (fn) {
      case "ai_breaker_state": {
        if (!b || b["state"] !== "open") return { data: "closed", error: null };
        if (this.ts(b["retryAt"]) > now || this.ts(b["probeUntil"]) > now) return { data: "open", error: null };
        return { data: "probe_ready", error: null };
      }
      case "ai_breaker_acquire_probe": {
        if (!b || b["state"] !== "open" || this.ts(b["retryAt"]) > now || this.ts(b["probeUntil"]) > now) return { data: null, error: null };
        const tok = uuid();
        b["probeToken"] = tok; b["probeUntil"] = this.iso(now + Number(a["_lease_seconds"]) * 1000);
        return { data: tok, error: null };
      }
      case "ai_breaker_close_probe": {
        if (b && a["_token"] && b["state"] === "open" && b["probeToken"] === a["_token"] && this.ts(b["probeUntil"]) > now) {
          this.state.set("ai_breaker", { state: "closed", closedAt: this.iso(now) });
          return { data: true, error: null };
        }
        return { data: false, error: null };
      }
      case "ai_breaker_release_probe": {
        if (b && a["_token"] && b["probeToken"] === a["_token"]) { delete b["probeToken"]; delete b["probeUntil"]; return { data: true, error: null }; }
        return { data: false, error: null };
      }
      case "ai_breaker_trip": {
        const was = b?.["state"] === "open";
        this.state.set("ai_breaker", {
          state: "open", code: String(a["_code"]).slice(0, 40), openedAt: was ? b!["openedAt"] : this.iso(now),
          retryAt: this.iso(now + Number(a["_cooldown_seconds"]) * 1000),
        });
        return { data: !was, error: null };
      }
      case "worker_heartbeat": this.state.set("worker", { at: this.iso(now) }); return { data: null, error: null };
      case "ops_alert_raise": {
        const k = `alert:${a["_key"]}`; const d = this.state.get(k);
        if (d && (d["pending"] || this.ts(d["sentAt"]) > now - Number(a["_dedupe_seconds"]) * 1000)) return { data: false, error: null };
        this.state.set(k, { pending: true, detail: a["_detail"], attempts: 0, incident: uuid() });
        return { data: true, error: null };
      }
      case "ops_alert_raise_once": {
        const k = `alert:${a["_key"]}`;
        if (this.state.has(k)) return { data: false, error: null };
        this.state.set(k, { pending: true, detail: a["_detail"], attempts: 0, incident: uuid() });
        return { data: true, error: null };
      }
      case "ops_alerts_due_v2": {
        const out = [...this.state.entries()].filter(([k, d]) => k.startsWith("alert:") && d["pending"] && this.ts(d["nextAt"]) <= now)
          .slice(0, Number(a["_limit"])).map(([k, d]) => ({ key: k.slice(6), detail: d["detail"], attempts: d["attempts"], incident: d["incident"] }));
        return { data: out, error: null };
      }
      case "ops_alert_claim": {
        const d = this.state.get(`alert:${a["_key"]}`);
        if (!d || !d["pending"] || this.ts(d["nextAt"]) > now || this.ts(d["claimedUntil"]) >= now) return { data: null, error: null };
        const tok = uuid(); d["claimToken"] = tok; d["claimedUntil"] = this.iso(now + 120_000);
        return { data: tok, error: null };
      }
      case "ops_alert_finish": {
        const d = this.state.get(`alert:${a["_key"]}`);
        if (!d || !a["_token"] || d["claimToken"] !== a["_token"]) return { data: false, error: null };
        delete d["claimToken"]; delete d["claimedUntil"];
        Object.assign(d, a["_patch"] as Row);
        return { data: true, error: null };
      }
      default: return { data: null, error: { message: `unknown rpc ${fn}` } };
    }
  }

  from(table: string) {
    const self = this;
    const filters: Array<(r: Row) => boolean> = [];
    let lim = Infinity;
    const q = {
      select: () => q,
      in: (col: string, vals: string[]) => { filters.push((r) => vals.includes(String(r[col]))); return q; },
      eq: () => q, not: () => q,
      gt: (col: string, v: string) => { if (col === "id") filters.push((r) => String(r["id"]) > v); return q; },
      order: () => q,
      limit: (n: number) => { lim = n; return q; },
      then(res: (v: { data: unknown; error: unknown }) => unknown) {
        let rows: Row[] = [];
        if (table === "ops_state") rows = [...self.state.entries()].map(([key, data]) => ({ key, data }));
        if (table === "fulfillment_orders") rows = [...self.unpaid].sort((x, y) => (x.id < y.id ? -1 : 1));
        return Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r))).slice(0, lim), error: null }).then(res);
      },
    };
    return q;
  }
}

export function installFakeOps(opts: { sessions?: SessionPort; sender?: AlertSend | null } = {}) {
  const db = new FakeOpsDb();
  __setOpsDbForTests(db, opts.sessions ?? null);
  __setOwnerSenderForTests(opts.sender === undefined ? null : opts.sender);
  return db;
}
