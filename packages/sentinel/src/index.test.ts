import { describe, expect, it } from "vitest";
import type { Contract, Row } from "@mycelium/contracts";
import {
  compileHealPrompt,
  computeBaseline,
  detectSymptom,
  scoreRun,
  validateValue,
} from "./index.js";

const contract: Contract = {
  collectorId: "c_test123",
  sourceUrl: "https://example.com/pricing",
  minRows: 3,
  fields: [
    {
      name: "plan",
      type: "string",
      required: true,
      description: "The plan tier name shown on the pricing card",
      sample: "Pro",
    },
    {
      name: "price",
      type: "number",
      required: true,
      description: "Monthly price in the page currency, numeric only",
      sample: "20",
    },
    {
      name: "docs_url",
      type: "url",
      required: false,
      description: "Link to the plan's documentation page",
      sample: "https://example.com/docs",
    },
  ],
};

const healthyRows: Row[] = [
  { plan: "Free", price: 0, docs_url: "https://example.com/docs" },
  { plan: "Pro", price: 20, docs_url: "https://example.com/docs" },
  { plan: "Team", price: 99, docs_url: null },
];

const baseline = {
  rowCount: 3,
  nullRates: { plan: 0, price: 0, docs_url: 1 / 3 },
};

describe("validateValue", () => {
  it("accepts matching types and rejects mismatches", () => {
    const price = contract.fields[1];
    expect(validateValue(price, 20)).toBe(true);
    expect(validateValue(price, "20")).toBe(false);
    expect(validateValue(price, NaN)).toBe(false);
    const url = contract.fields[2];
    expect(validateValue(url, "https://a.b")).toBe(true);
    expect(validateValue(url, "not a url")).toBe(false);
  });
  it("treats null, undefined and empty string as nullish", () => {
    const plan = contract.fields[0];
    expect(validateValue(plan, null)).toBe(false);
    expect(validateValue(plan, undefined)).toBe(false);
    expect(validateValue(plan, "")).toBe(false);
  });
});

describe("scoreRun", () => {
  it("scores a clean run healthy", () => {
    const s = scoreRun(healthyRows, contract, baseline);
    expect(s.verdict).toBe("healthy");
    expect(s.rowCount).toBe(3);
    expect(s.nullRates.price).toBe(0);
  });

  it("scores zero rows broken", () => {
    expect(scoreRun([], contract, baseline).verdict).toBe("broken");
  });

  it("scores a required field gone ~all null as broken", () => {
    const rows = healthyRows.map((r) => ({ ...r, price: null }));
    const s = scoreRun(rows, contract, baseline);
    expect(s.verdict).toBe("broken");
    expect(s.nullRates.price).toBe(1);
  });

  it("does not break on an optional field going null", () => {
    const rows = healthyRows.map((r) => ({ ...r, docs_url: null }));
    const s = scoreRun(rows, contract, baseline);
    expect(s.verdict).not.toBe("broken");
  });

  it("degrades when null rate drifts past baseline + 0.3", () => {
    const rows = [
      { plan: "Free", price: 0, docs_url: null },
      { plan: "Pro", price: null, docs_url: null },
      { plan: "Team", price: null, docs_url: null },
    ];
    const s = scoreRun(rows, contract, baseline);
    expect(s.verdict).toBe("degraded");
  });

  it("degrades when row count collapses below 50% of baseline", () => {
    const s = scoreRun([healthyRows[0]], contract, {
      ...baseline,
      rowCount: 10,
    });
    expect(s.verdict).toBe("degraded");
  });

  it("without a baseline, uses contract.minRows as the floor", () => {
    const s = scoreRun(healthyRows.slice(0, 2), contract, null);
    expect(s.verdict).toBe("degraded");
  });

  it("counts type errors without marking them null", () => {
    const rows = healthyRows.map((r) => ({ ...r, price: "twenty" }));
    const s = scoreRun(rows, contract, baseline);
    expect(s.typeErrors.price).toBe(3);
    expect(s.nullRates.price).toBe(0);
  });

  it("shape hash is stable across row order and value changes", () => {
    const a = scoreRun(healthyRows, contract, baseline).shapeHash;
    const b = scoreRun([...healthyRows].reverse(), contract, baseline).shapeHash;
    expect(a).toBe(b);
  });
});

describe("computeBaseline", () => {
  it("returns null with no healthy runs (birth certificate gate)", () => {
    expect(computeBaseline([])).toBeNull();
  });
  it("uses the median so an outlier run cannot drag the reference", () => {
    const b = computeBaseline([
      { rowCount: 40, nullRates: { price: 0 } },
      { rowCount: 41, nullRates: { price: 0 } },
      { rowCount: 400, nullRates: { price: 0.9 } },
    ]);
    expect(b?.rowCount).toBe(41);
    expect(b?.nullRates.price).toBe(0);
  });
});

describe("compileHealPrompt", () => {
  it("names the field, the type, the sample and the page", () => {
    const score = scoreRun(
      healthyRows.map((r) => ({ ...r, price: null })),
      contract,
      baseline,
    );
    const symptom = detectSymptom(score, baseline, contract, "2026-08-20");
    const p = compileHealPrompt(symptom, contract);
    expect(p).toContain("price");
    expect(p).toContain("number");
    expect(p).toContain('e.g. "20"');
    expect(p).toContain(contract.sourceUrl);
    expect(p.length).toBeLessThanOrEqual(1000);
  });

  it("stays under the cap even with many verbose fields, keeping names and types", () => {
    const bigContract: Contract = {
      ...contract,
      fields: Array.from({ length: 12 }, (_, i) => ({
        name: `field_with_a_long_name_${i}`,
        type: "string" as const,
        required: true,
        description:
          "An extremely verbose plain-language description that goes on and on about where this field lives on the page and what it should contain. ".repeat(
            3,
          ),
        sample: "sample-value-" + i,
      })),
    };
    const symptom = {
      brokenFields: bigContract.fields.map((f) => f.name),
      rowsBefore: 41,
      rowsAfter: 0,
      since: "2026-08-20",
    };
    const p = compileHealPrompt(symptom, bigContract);
    expect(p.length).toBeLessThanOrEqual(1000);
    expect(p).toContain("field_with_a_long_name_0");
  });
});
