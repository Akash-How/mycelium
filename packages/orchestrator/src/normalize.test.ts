import { describe, expect, it } from "vitest";
import { normalizeRows } from "./normalize.js";

describe("normalizeRows", () => {
  it("passes flat rows through, stripping noise keys", () => {
    const rows = normalizeRows([
      { title: "A", price: 5, input: { url: "x" } },
      { title: "B", price: 7, input: { url: "x" } },
    ]);
    expect(rows).toEqual([
      { title: "A", price: 5 },
      { title: "B", price: 7 },
    ]);
  });

  it("unnests the wrapper-row shape collectors sometimes return", () => {
    const rows = normalizeRows([
      {
        models: [
          { model_name: "Llama 3.3 70B", input_price_per_1m: 0.88 },
          { model_name: "Qwen 2.5 72B", input_price_per_1m: 1.2 },
        ],
        product_page_url: "https://www.together.ai/pricing",
        input: { url: "https://www.together.ai/pricing" },
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].model_name).toBe("Llama 3.3 70B");
  });

  it("an empty nested array normalizes to zero rows — visible to the sentinel as broken", () => {
    const rows = normalizeRows([
      { models: [], input: { url: "x" } },
    ]);
    expect(rows).toEqual([]);
  });

  it("lifts one level of {value} nesting", () => {
    const rows = normalizeRows([
      { title: "Book", price: { value: 51.77, currency: "GBP" } },
    ]);
    expect(rows[0].price).toBe(51.77);
  });

  it("returns empty for non-array garbage", () => {
    expect(normalizeRows("nope")).toEqual([]);
    expect(normalizeRows(null)).toEqual([]);
  });
});

describe("deduplication", () => {
  it("collapses rows the scraper emitted multiple times from different DOM matches", () => {
    const dup = [
      { program_name: "Adobe Public", bounty_range: "$75 - $15,000" },
      { program_name: "Adobe Public", bounty_range: "$75 - $15,000" },
      { program_name: "Adobe Public", bounty_range: "$75 - $15,000" },
      { program_name: "Dutch Lottery VDP", bounty_range: null },
    ];
    const rows = normalizeRows(dup);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.program_name)).toEqual(["Adobe Public", "Dutch Lottery VDP"]);
  });

  it("keeps same-named entities that differ in any other field", () => {
    const rows = normalizeRows([
      { program_name: "Acme", bounty_range: "$100" },
      { program_name: "Acme", bounty_range: "$500" },
    ]);
    expect(rows).toHaveLength(2);
  });

  it("dedupes inside the nested wrapper shape too", () => {
    const rows = normalizeRows([
      { programs: [{ n: "a" }, { n: "a" }, { n: "b" }], input: { url: "x" } },
    ]);
    expect(rows).toHaveLength(2);
  });
});
