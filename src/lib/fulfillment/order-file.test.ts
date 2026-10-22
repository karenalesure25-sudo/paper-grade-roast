import { describe, expect, test } from "bun:test";
import type { DeliveredPackage, OrderRow } from "./engine";
import { serveOrderFile, type OrderFileDeps } from "./order-file";
import type { RevisionRow } from "./revision";
import type { FullResume } from "./validate";

// Synthetic, isolated data; injected lookups only — no live database.
const resume = (bullet: string): FullResume => ({
  name: "Avery Stone", email: "avery@kcs-test.dev", phone: "303-555-2211", title: "Operations Coordinator", location: "Denver CO",
  summary: "Operations coordinator.", objective: "",
  experience: [{ company: "Northwind Logistics", role: "Operations Coordinator", location: "Denver CO", dates: "2019 - 2023", bullets: [bullet] }],
  education: [], skills: ["SAP"], certifications: [],
});
const pkg = (b: string) => ({ resume: resume(b), validatedAt: "2026-10-05T20:00:00Z", checks: {} } as unknown as DeliveredPackage);
const TOK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REV_A = "00000000-0000-4000-8000-00000000000a";
const REV_B = "00000000-0000-4000-8000-00000000000b";
const REV_Q = "00000000-0000-4000-8000-00000000000c";
const NOW = new Date("2026-10-10T00:00:00Z");

function order(id: string, token: string, over: Partial<OrderRow> = {}): OrderRow {
  return { id, access_token: token, status: "ready", paid_at: "2026-10-04T00:00:00Z", expires_at: "2026-11-03T00:00:00Z",
    template: "sidebar", photo: null, result: pkg("ORIGINAL bullet"), ...over } as unknown as OrderRow;
}
const rev = (id: string, orderId: string, over: Partial<RevisionRow> = {}) =>
  ({ id, order_id: orderId, status: "ready", version: 2, result: pkg(`REVISED ${id} bullet`), ...over } as unknown as RevisionRow);

function deps(orders: OrderRow[], revs: RevisionRow[]): OrderFileDeps {
  return {
    async orderByToken(t) { return orders.find((o) => o.access_token === t) ?? null; },
    async revisionById(id) { return revs.find((r) => r.id === id) ?? null; },
  };
}
const get = (d: OrderFileDeps, token: string, file: string, q = "") =>
  serveOrderFile(d, { token, file }, `https://x.test/api/public/order-file/${token}/${file}${q}`, NOW);

describe("order-file route authorization", () => {
  const d = deps(
    [order("oA", TOK_A), order("oB", TOK_B)],
    [rev(REV_A, "oA"), rev(REV_B, "oB"), rev(REV_Q, "oA", { status: "processing", version: null, result: null })],
  );

  test("valid token: original and its own v2 download", async () => {
    const orig = await get(d, TOK_A, "resume.html");
    expect(orig.status).toBe(200);
    expect(await orig.text()).toContain("ORIGINAL bullet");
    const v2 = await get(d, TOK_A, "resume.html", `?v=${REV_A}`);
    expect(v2.status).toBe(200);
    expect(v2.headers.get("Content-Disposition")).toContain("-v2-resume.html");
    expect(v2.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await v2.text()).toContain(`REVISED ${REV_A} bullet`);
    expect((await get(d, TOK_A, "resume.docx", `?v=${REV_A}`)).status).toBe(200);
  });

  test("foreign revision id with another order's valid token is refused", async () => {
    const r = await get(d, TOK_A, "resume.html", `?v=${REV_B}`);
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("REVISED");
  });

  test("nonexistent, malformed and not-ready revisions are refused", async () => {
    expect((await get(d, TOK_A, "resume.html", "?v=00000000-0000-4000-8000-000000000999")).status).toBe(404);
    expect((await get(d, TOK_A, "resume.html", "?v=not-a-uuid")).status).toBe(404);
    expect((await get(d, TOK_A, "resume.html", `?v=${REV_Q}`)).status).toBe(404);
    expect((await get(d, TOK_A, "secrets.txt")).status).toBe(404);
    expect((await get(d, TOK_A, "cover-letter.html")).status).toBe(404);
  });

  test("unknown token, unpaid, not-ready and expired orders are refused", async () => {
    expect((await get(d, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "resume.html")).status).toBe(404);
    for (const over of [{ paid_at: null }, { status: "processing" }, { expires_at: "2026-10-01T00:00:00Z" }, { result: null }] as Partial<OrderRow>[]) {
      const dd = deps([order("oA", TOK_A, over)], [rev(REV_A, "oA")]);
      expect((await get(dd, TOK_A, "resume.html")).status).toBe(404);
      expect((await get(dd, TOK_A, "resume.html", `?v=${REV_A}`)).status).toBe(404);
    }
  });
});
