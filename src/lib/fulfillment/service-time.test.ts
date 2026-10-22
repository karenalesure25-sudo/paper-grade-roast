import { describe, expect, test } from "bun:test";
import { addEligibleHours, deliveryWindow, isChicagoSunday, minorRevisionWindowEnd } from "./service-time";

describe("Central Time service windows", () => {
  test("48 hours from Friday noon skips all of Sunday", () => {
    // Fri Oct 9 2026 12:00 CDT = 17:00Z. Fri 12h + Sat 24h = 36h; Sunday skipped; Mon +12h → Mon 12:00 CDT.
    expect(addEligibleHours("2026-10-09T17:00:00Z", 48).toISOString()).toBe("2026-10-12T17:00:00.000Z");
  });

  test("a request made on Sunday starts counting Monday 00:00 Central", () => {
    // Sun Oct 11 10:00 CDT → Mon 00:00 CDT (05:00Z) + 24h = Tue 00:00 CDT
    expect(addEligibleHours("2026-10-11T15:00:00Z", 24).toISOString()).toBe("2026-10-13T05:00:00.000Z");
    expect(isChicagoSunday(Date.parse("2026-10-11T15:00:00Z"))).toBe(true);
    expect(isChicagoSunday(Date.parse("2026-10-12T04:59:59Z"))).toBe(true); // still Sun 23:59 CDT
    expect(isChicagoSunday(Date.parse("2026-10-12T05:00:00Z"))).toBe(false);
  });

  test("DST end (Sun Nov 1 2026): Sunday excluded, offsets shift to CST", () => {
    // Fri Oct 30 12:00 CDT (17:00Z) + 48h: Fri 12h + Sat 24h, skip Sun (25h long), Mon 00:00 CST = 06:00Z, +12h → 18:00Z
    expect(addEligibleHours("2026-10-30T17:00:00Z", 48).toISOString()).toBe("2026-11-02T18:00:00.000Z");
  });

  test("DST start (Sun Mar 8 2026): Sunday excluded, offsets shift to CDT", () => {
    // Fri Mar 6 12:00 CST (18:00Z) + 48h → Mon Mar 9 12:00 CDT = 17:00Z
    expect(addEligibleHours("2026-03-06T18:00:00Z", 48).toISOString()).toBe("2026-03-09T17:00:00.000Z");
  });

  test("delivery window is 24–48 eligible hours", () => {
    const w = deliveryWindow("2026-10-06T15:00:00Z"); // Tue
    expect(w.earliest.toISOString()).toBe("2026-10-07T15:00:00.000Z");
    expect(w.latest.toISOString()).toBe("2026-10-08T15:00:00.000Z");
  });

  test("minor window ends at Central midnight after the 7th calendar day, across DST", () => {
    expect(minorRevisionWindowEnd("2026-10-30T23:00:00Z").toISOString()).toBe("2026-11-07T06:00:00.000Z"); // Fri Oct 30 CDT → Sat Nov 7 00:00 CST
    // Late-evening Central delivery belongs to that Central date, not the UTC date.
    expect(minorRevisionWindowEnd("2026-10-06T04:30:00Z").toISOString()).toBe("2026-10-13T05:00:00.000Z"); // Mon Oct 5 23:30 CDT
  });
});
