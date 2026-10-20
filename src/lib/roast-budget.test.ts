import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  return vi.fn((_url: string, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  );
}

describe("roast grading time budget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("gives up within the total budget when every model call hangs, and shows no grade", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const start = Date.now();
    let settledAt = 0;
    const result = gradeResumeText(RESUME, "text").then((r) => ((settledAt = Date.now()), r));
    await vi.advanceTimersByTimeAsync(TOTAL_BUDGET_MS + 5_000);
    const outcome = await result;
    expect(outcome.status).toBe("unavailable");
    expect(settledAt - start).toBeLessThanOrEqual(TOTAL_BUDGET_MS);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("budget stays under the 130-second browser wait so the server answers first", () => {
    expect(TOTAL_BUDGET_MS).toBe(100_000);
    expect(TOTAL_BUDGET_MS).toBeLessThan(130_000);
  });
});
