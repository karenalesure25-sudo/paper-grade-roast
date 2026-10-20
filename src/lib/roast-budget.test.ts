import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { gradeResumeText, TOTAL_BUDGET_MS } from "./roast.server";

const RESUME = `Jordan Rivera
Operations Coordinator | Chicago, IL | jordan@example.test
Experience
Operations Coordinator, Northwind Logistics, 2021 to present
Coordinated weekly shipping schedules for regional warehouses and resolved carrier delays with vendors.
Maintained inventory records in the warehouse system and trained new staff on receiving procedures.
Education
Bachelor of Science in Business Administration, Illinois State University, 2020
Skills
Scheduling, inventory control, vendor communication, Excel, process documentation`;

/** fetch that never answers until the caller aborts it — simulates a hung model call. */
function hangingFetch() {
  return mock((_url: string, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  );
}

describe("roast grading time budget", () => {
  // Simulated clock: each timer fires at once and moves "now" forward by its delay.
  let now = 0;
  const realSetTimeout = globalThis.setTimeout;
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    now = 1_000_000;
    process.env["LOVABLE_API_KEY"] = "test-key";
    spyOn(console, "error").mockImplementation(() => {});
    spyOn(Date, "now").mockImplementation(() => now);
    globalThis.setTimeout = ((cb: () => void, ms = 0) => realSetTimeout(() => { now += ms; cb(); }, 0)) as typeof setTimeout;
  });
  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
    globalThis.fetch = realFetch;
    delete process.env["LOVABLE_API_KEY"];
    mock.restore();
  });

  it("gives up within the total budget when every model call hangs, and shows no grade", async () => {
    const fetchMock = hangingFetch();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const start = now;
    const outcome = await gradeResumeText(RESUME, "text");
    expect(outcome.status).toBe("unavailable");
    expect(now - start).toBeLessThanOrEqual(TOTAL_BUDGET_MS);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("budget stays under the 130-second browser wait so the server answers first", () => {
    expect(TOTAL_BUDGET_MS).toBe(100_000);
    expect(TOTAL_BUDGET_MS).toBeLessThan(130_000);
  });
});
