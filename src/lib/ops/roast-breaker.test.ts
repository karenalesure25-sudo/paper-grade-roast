import { afterEach, describe, expect, mock, test } from "bun:test";
import { gradeResumeText } from "../roast.server";

const fake = (globalThis as { __opsFake?: { gate: string; trips: string[] } }).__opsFake!;
const RESUME = `Jordan Rivera
Operations Coordinator | Chicago, IL
Experience
Operations Coordinator, Northwind Logistics, 2021 to present
Coordinated weekly shipping schedules for regional warehouses and resolved carrier delays with vendors.
Maintained inventory records in the warehouse system and trained new staff on receiving procedures.
Education
Bachelor of Science in Business Administration, Illinois State University, 2020
Skills
Scheduling, inventory control, vendor communication, Excel, process documentation`;

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; fake.gate = "closed"; fake.trips.length = 0; delete process.env["LOVABLE_API_KEY"]; });

describe("free roast and the outage breaker", () => {
  test("open breaker: no gateway call is made, pause message shown", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    fake.gate = "open";
    const f = mock(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = f as unknown as typeof fetch;
    const r = await gradeResumeText(RESUME, "text");
    expect(r).toEqual({ status: "unavailable", message: "Grading is paused right now. Try again later." });
    expect(f).toHaveBeenCalledTimes(0);
  });

  test("402 trips the shared breaker and stops after one call (no retry burn)", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    const f = mock(async () => new Response(JSON.stringify({ type: "payment_required" }), { status: 402 }));
    globalThis.fetch = f as unknown as typeof fetch;
    const r = await gradeResumeText(RESUME, "text");
    expect(r.status).toBe("unavailable");
    expect(f).toHaveBeenCalledTimes(1);
    expect(fake.trips).toEqual(["credits_exhausted"]);
  });
});
