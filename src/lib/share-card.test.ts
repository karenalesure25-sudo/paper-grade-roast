import { describe, expect, test } from "bun:test";
import { shareCopy, SHARE_QUIPS } from "./share-card";

describe("share card", () => {
  test("every grade has a quip and the public roast link", () => {
    for (const g of ["A", "B", "C", "D", "F"] as const) {
      const c = shareCopy(g);
      expect(c.quip).toBe(SHARE_QUIPS[g]);
      expect(c.url).toBe("https://paper-grade-roast.lovable.app/roast");
      expect(c.text).toContain(c.url);
    }
  });
  test("share copy is built from the grade only (no résumé input accepted)", () => {
    expect(shareCopy.length).toBe(1);
  });
});
