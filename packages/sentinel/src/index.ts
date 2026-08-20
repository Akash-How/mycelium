import { createHash } from "node:crypto";
import type {
  Baseline,
  Contract,
  Field,
  Row,
  RunScore,
  Verdict,
} from "@mycelium/contracts";

const BROKEN_NULL_RATE = 0.8;
const DEGRADED_NULL_DELTA = 0.3;
const DEGRADED_ROW_RATIO = 0.5;

function isNullish(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

export function validateValue(field: Field, v: unknown): boolean {
  if (isNullish(v)) return false;
  switch (field.type) {
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "boolean":
      return typeof v === "boolean";
    case "url":
      return typeof v === "string" && /^https?:\/\//.test(v);
    case "string":
      return typeof v === "string" && v.length > 0;
  }
}

export function shapeHash(rows: Row[]): string {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  return createHash("sha1").update([...keys].sort().join("|")).digest("hex");
}

export function scoreRun(
  rows: Row[],
  contract: Contract,
  baseline: Baseline | null,
): RunScore {
  const nullRates: Record<string, number> = {};
  const typeErrors: Record<string, number> = {};

  for (const field of contract.fields) {
    let nulls = 0;
    let bad = 0;
    for (const row of rows) {
      const v = row[field.name];
      if (isNullish(v)) nulls++;
      else if (!validateValue(field, v)) bad++;
    }
    nullRates[field.name] = rows.length === 0 ? 1 : nulls / rows.length;
    typeErrors[field.name] = bad;
  }

  let verdict: Verdict = "healthy";

  const requiredBroken = contract.fields.some(
    (f) => f.required && nullRates[f.name] > BROKEN_NULL_RATE,
  );
  if (rows.length === 0 || requiredBroken) {
    verdict = "broken";
  } else if (baseline) {
    const nullDrifted = contract.fields.some(
      (f) => nullRates[f.name] > (baseline.nullRates[f.name] ?? 0) + DEGRADED_NULL_DELTA,
    );
    const rowsCollapsed = rows.length < baseline.rowCount * DEGRADED_ROW_RATIO;
    if (nullDrifted || rowsCollapsed) verdict = "degraded";
  } else if (rows.length < contract.minRows) {
    verdict = "degraded";
  }

  return {
    verdict,
    rowCount: rows.length,
    nullRates,
    typeErrors,
    shapeHash: shapeHash(rows),
  };
}

// Baseline = median over the last N healthy runs. Median, not mean: one
// weird-but-healthy run must not drag the reference.
export function computeBaseline(
  healthyRuns: { rowCount: number; nullRates: Record<string, number> }[],
): Baseline | null {
  if (healthyRuns.length === 0) return null;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const fields = new Set(healthyRuns.flatMap((r) => Object.keys(r.nullRates)));
  const nullRates: Record<string, number> = {};
  for (const f of fields) {
    nullRates[f] = median(healthyRuns.map((r) => r.nullRates[f] ?? 0));
  }
  return { rowCount: median(healthyRuns.map((r) => r.rowCount)), nullRates };
}

export interface Symptom {
  brokenFields: string[];
  rowsBefore: number;
  rowsAfter: number;
  since: string;
}

export function detectSymptom(
  score: RunScore,
  baseline: Baseline | null,
  contract: Contract,
  detectedAt: string,
): Symptom {
  const brokenFields = contract.fields
    .filter((f) => score.nullRates[f.name] > BROKEN_NULL_RATE)
    .map((f) => f.name);
  return {
    brokenFields,
    rowsBefore: baseline?.rowCount ?? contract.minRows,
    rowsAfter: score.rowCount,
    since: detectedAt,
  };
}

// The heal prompt is capped at 1000 chars by the platform, so it is compiled,
// not concatenated. Overflow drops, in order: prose, row delta, sample value.
// The field name and expected type are never dropped.
const PROMPT_CAP = 1000;

export function compileHealPrompt(
  symptom: Symptom,
  contract: Contract,
): string {
  const fields = contract.fields.filter((f) =>
    symptom.brokenFields.includes(f.name),
  );
  const names = fields.map((f) => f.name).join(", ");

  const expectations = (withSample: boolean, withDescription: boolean) =>
    fields
      .map((f) => {
        let s = `Expected ${f.name}: ${f.type}`;
        if (withSample) s += `, e.g. "${f.sample}"`;
        if (withDescription) s += ` — ${f.description}`;
        return s + ".";
      })
      .join(" ");

  const rowDelta = `Row count ${symptom.rowsBefore} -> ${symptom.rowsAfter}.`;
  const head = `Fields ${names} return null since ${symptom.since}.`;
  const tail = `Other fields extract correctly. Page: ${contract.sourceUrl}`;

  const attempts = [
    [head, expectations(true, true), rowDelta, tail],
    [head, expectations(true, false), rowDelta, tail],
    [head, expectations(true, false), tail],
    [head, expectations(false, false), tail],
  ];
  for (const parts of attempts) {
    const prompt = parts.join(" ");
    if (prompt.length <= PROMPT_CAP) return prompt;
  }
  return attempts[attempts.length - 1].join(" ").slice(0, PROMPT_CAP);
}
