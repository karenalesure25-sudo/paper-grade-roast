import * as bunTest from "bun:test";
import { expect, test } from "bun:test";

const describe = bunTest.describe as unknown as { skipIf(c: boolean): (name: string, fn: () => void) => void };
const spawnSync = (globalThis as unknown as { Bun: { spawnSync(cmd: string[]): { stderr: { toString(): string }; exitCode: number } } }).Bun.spawnSync;

/**
 * Runs the SQL fencing checks against a THROWAWAY local Postgres (never the project database).
 * Set OPS_SQL_TEST_PSQL to a psql connection prefix, e.g.
 *   OPS_SQL_TEST_PSQL="psql -X -h /tmp/pgt -p 55432 -U postgres"
 * after applying drizzle/migrations/0008 and 0009 there. Skipped when unset.
 */
const psql = process.env["OPS_SQL_TEST_PSQL"];

describe.skipIf(!psql)("ops SQL fencing (local throwaway Postgres)", () => {
  test("probe tokens, supersession, alert incidents", () => {
    const file = new URL("./ops-fencing.check.sql", import.meta.url).pathname;
    const r = spawnSync(["sh", "-c", `${psql} -v ON_ERROR_STOP=1 -f '${file}'`]);
    const err = r.stderr.toString();
    expect(err).toContain("ops fencing checks passed");
    expect(r.exitCode).toBe(0);
  });
});
