import type { Row } from "@mycelium/contracts";

// Collectors return arbitrary shapes: sometimes flat rows, sometimes one
// wrapper row per input URL with the real rows nested in an array field
// (e.g. [{ models: [...], input: {...} }]). Normalize to flat rows before
// the sentinel sees them, so contracts stay simple.
const NOISE_KEYS = new Set(["input", "product_page_url", "url", "timestamp"]);

/**
 * Drop exact duplicate rows. Generated scrapers sometimes match the same
 * entity through several DOM containers, emitting it N times per run — seen
 * in the wild at exactly 8x. Duplicates inflate row counts (fooling the
 * sentinel's baseline) without adding information, so they are removed before
 * anything downstream sees them.
 */
function dedupe(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of rows) {
    const key = JSON.stringify(Object.entries(r).sort());
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function normalizeRows(raw: unknown): Row[] {
  if (!Array.isArray(raw)) return [];
  const rows = raw.filter((r): r is Row => typeof r === "object" && r !== null);
  if (rows.length === 0) return [];

  // Wrapper detection: every row's only substantial value is one array field.
  const first = rows[0];
  const arrayKeys = Object.keys(first).filter(
    (k) => Array.isArray(first[k]) && !NOISE_KEYS.has(k),
  );
  const dataKeys = Object.keys(first).filter(
    (k) => !NOISE_KEYS.has(k) && !Array.isArray(first[k]),
  );
  if (arrayKeys.length === 1 && dataKeys.length === 0) {
    return dedupe(
      rows.flatMap((r) => {
        const nested = r[arrayKeys[0]];
        return Array.isArray(nested) ? (nested as Row[]) : [];
      }),
    );
  }

  // Flatten one level of nested objects ({price: {value: 51.77}} -> price: 51.77)
  return dedupe(
    rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      if (NOISE_KEYS.has(k)) continue;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        const inner = v as Record<string, unknown>;
        if ("value" in inner) out[k] = inner.value;
        else out[k] = v;
      } else {
        out[k] = v;
      }
    }
    return out;
    }),
  );
}
