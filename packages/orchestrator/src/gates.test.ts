import { describe, expect, it } from "vitest";
import type { Contract, Row } from "@mycelium/contracts";
import {
  allPass,
  continuityGate,
  contractGate,
  goldenGate,
  runGates,
} from "./gates.js";

const contract: Contract = {
  collectorId: "c_test123",
  sourceUrl: "https://example.com/pricing",
  minRows: 2,
  fields: [
    { name: "plan", type: "string", required: true, description: "Plan tier name on the card", sample: "Pro" },
    { name: "price", type: "number", required: true, description: "Monthly price, numeric", sample: "20" },
  ],
};

const healthy: Row[] = [
  { plan: "Free", price: 0 },
  { plan: "Pro", price: 20 },
  { plan: "Team", price: 99 },
];

describe("contractGate", () => {
  it("passes a clean preview", () => {
    expect(contractGate(healthy, contract)).toBe(true);
  });
  it("fails under minRows", () => {
    expect(contractGate([healthy[0]], contract)).toBe(false);
  });
  it("fails when a required field is mostly invalid", () => {
    const rows = healthy.map((r) => ({ ...r, price: "N/A" }));
    expect(contractGate(rows, contract)).toBe(false);
  });
});

describe("goldenGate", () => {
  const fixtures = [{ field: "price", rowKey: "Pro", expected: "20" }];
  it("passes when the known value still returns", () => {
    expect(goldenGate(healthy, contract, fixtures)).toBe(true);
  });
  it("fails when the known value changed under the heal", () => {
    const rows = healthy.map((r) =>
      r.plan === "Pro" ? { ...r, price: 25 } : r,
    );
    expect(goldenGate(rows, contract, fixtures)).toBe(false);
  });
  it("fails when the fixture row vanished", () => {
    expect(goldenGate(healthy.slice(0, 1), contract, fixtures)).toBe(false);
  });
  it("is vacuous with no fixtures recorded", () => {
    expect(goldenGate([], contract, [])).toBe(true);
  });
});

describe("continuityGate", () => {
  it("passes plausible drift", () => {
    const now = healthy.map((r) =>
      r.plan === "Pro" ? { ...r, price: 22 } : r,
    );
    expect(continuityGate(now, healthy, contract)).toBe(true);
  });
  it("fails a 10x jump — the heal grabbed the wrong element", () => {
    const now = healthy.map((r) =>
      r.plan === "Team" ? { ...r, price: 990000 } : r,
    );
    expect(continuityGate(now, healthy, contract)).toBe(false);
  });
  it("passes with no history", () => {
    expect(continuityGate(healthy, [], contract)).toBe(true);
  });
});

describe("runGates", () => {
  it("all three must pass for approval", () => {
    const gates = runGates(healthy, contract, [], healthy);
    expect(allPass(gates)).toBe(true);
    const bad = runGates([], contract, [], healthy);
    expect(allPass(bad)).toBe(false);
  });
});
