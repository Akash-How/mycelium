import { describe, expect, it, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type { Contract, Row } from "@mycelium/contracts";
import { ensureWatchSchema, entityKey, recordSightings } from "./watch.js";

const contract: Contract = {
  collectorId: "c_test123",
  sourceUrl: "https://example.com/programs",
  minRows: 1,
  fields: [
    { name: "program_name", type: "string", required: true, description: "The bug bounty program name", sample: "Acme" },
    { name: "bounty_max", type: "number", required: false, description: "Max bounty in USD", sample: "5000" },
  ],
};

const rows = (...names: string[]): Row[] =>
  names.map((n) => ({ program_name: n, bounty_max: 1000 }));

let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE source (id INTEGER PRIMARY KEY)");
  db.exec("INSERT INTO source (id) VALUES (1)");
  ensureWatchSchema(db as any);
});

describe("entityKey", () => {
  it("keys on the first required string field, normalised", () => {
    expect(entityKey({ program_name: "  Acme Corp  " }, contract)).toBe("acme corp");
  });
});

describe("recordSightings", () => {
  it("seeds silently on the first sweep — day one is not breaking news", () => {
    const r = recordSightings(db as any, 1, rows("acme", "globex"), contract);
    expect(r.isFirstSweep).toBe(true);
    expect(r.added).toHaveLength(0);
  });

  it("reports only genuinely new entities on later sweeps", () => {
    recordSightings(db as any, 1, rows("acme", "globex"), contract);
    const r = recordSightings(db as any, 1, rows("acme", "globex", "initech"), contract);
    expect(r.isFirstSweep).toBe(false);
    expect(r.added.map((a) => a.key)).toEqual(["initech"]);
  });

  it("does not re-report an entity already announced", () => {
    recordSightings(db as any, 1, rows("acme"), contract);
    recordSightings(db as any, 1, rows("acme", "initech"), contract);
    const r = recordSightings(db as any, 1, rows("acme", "initech"), contract);
    expect(r.added).toHaveLength(0);
  });

  it("treats a vanished entity as no news — removals never alert", () => {
    recordSightings(db as any, 1, rows("acme", "globex"), contract);
    const r = recordSightings(db as any, 1, rows("acme"), contract);
    expect(r.added).toHaveLength(0);
  });

  it("ignores rows with an empty key rather than inventing entities", () => {
    recordSightings(db as any, 1, rows("acme"), contract);
    const r = recordSightings(db as any, 1, [{ program_name: "  " }, ...rows("zeta")], contract);
    expect(r.added.map((a) => a.key)).toEqual(["zeta"]);
  });

  it("keeps sources independent", () => {
    db.exec("INSERT INTO source (id) VALUES (2)");
    recordSightings(db as any, 1, rows("acme"), contract);
    const r = recordSightings(db as any, 2, rows("acme"), contract);
    expect(r.isFirstSweep).toBe(true); // source 2 has its own baseline
  });
});
