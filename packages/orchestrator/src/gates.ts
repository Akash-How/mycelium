import type { Contract, GateResults, Row } from "@mycelium/contracts";
import { validateValue } from "@mycelium/sentinel";

export interface GoldenFixture {
  field: string;
  rowKey: string; // value of the contract's first field identifying the row
  expected: string;
}

// A heal that "succeeds" but returns plausible garbage poisons the dataset
// silently — worse than a clean failure. So --auto-approve is never used:
// a repair is committed only if all three gates pass.

export function contractGate(rows: Row[], contract: Contract): boolean {
  if (rows.length < contract.minRows) return false;
  return contract.fields.every((f) => {
    if (!f.required) return true;
    const valid = rows.filter((r) => validateValue(f, r[f.name])).length;
    return valid / rows.length >= 0.8;
  });
}

export function goldenGate(rows: Row[], contract: Contract, fixtures: GoldenFixture[]): boolean {
  if (fixtures.length === 0) return true; // nothing recorded yet — gate is vacuous
  const keyField = contract.fields[0].name;
  return fixtures.every((fx) => {
    const row = rows.find((r) => String(r[keyField]) === fx.rowKey);
    if (!row) return false;
    return String(row[fx.field]) === fx.expected;
  });
}

// Numeric fields must land within a plausible delta of the last healthy run.
// Catches a heal that latched onto the wrong element (a price of 49 becoming
// 490000 is not a price change).
const MAX_NUMERIC_RATIO = 10;

export function continuityGate(
  rows: Row[],
  lastHealthyRows: Row[],
  contract: Contract,
): boolean {
  if (lastHealthyRows.length === 0) return true;
  const keyField = contract.fields[0].name;
  const numericFields = contract.fields.filter((f) => f.type === "number");
  for (const f of numericFields) {
    for (const row of rows) {
      const prev = lastHealthyRows.find(
        (r) => String(r[keyField]) === String(row[keyField]),
      );
      const a = row[f.name];
      const b = prev?.[f.name];
      if (typeof a !== "number" || typeof b !== "number") continue;
      if (a === 0 || b === 0) continue;
      const ratio = Math.abs(a) > Math.abs(b) ? a / b : b / a;
      if (Math.abs(ratio) > MAX_NUMERIC_RATIO) return false;
    }
  }
  return true;
}

export function runGates(
  preview: Row[],
  contract: Contract,
  fixtures: GoldenFixture[],
  lastHealthyRows: Row[],
): GateResults {
  return {
    contract: contractGate(preview, contract),
    golden: goldenGate(preview, contract, fixtures),
    continuity: continuityGate(preview, lastHealthyRows, contract),
  };
}

export const allPass = (g: GateResults) => g.contract && g.golden && g.continuity;
