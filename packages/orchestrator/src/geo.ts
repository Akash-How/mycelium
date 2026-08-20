import type { Db } from "./db.js";
import { scrapePage } from "./bdata.js";

// Geo divergence probes. Scraper Studio runs have no per-run geo control,
// so structured extraction is global — but the unlocker (`scrape`) does take
// --country. We fetch the raw page per market and extract price-like tokens.
// Page-level, honestly labelled: it detects THAT a market diverges; the
// collector documents WHAT the price table says.

const PRICE_RE =
  /(?:\$|€|£|₹|R\$|¥)\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:USD|EUR|GBP|INR|BRL|JPY)/g;

export function ensureGeoSchema(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS geo_probe (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES source(id),
    country TEXT NOT NULL,
    probed_at TEXT NOT NULL DEFAULT (datetime('now')),
    signal_count INTEGER NOT NULL,
    top_signals TEXT NOT NULL,
    currency_set TEXT NOT NULL
  )`);
}

export async function probeSource(
  db: Db,
  sourceId: number,
  url: string,
  countries: string[],
) {
  ensureGeoSchema(db);
  for (const country of countries) {
    const res = await scrapePage(url, country);
    if (!res.ok) continue;
    const signals = res.stdout.match(PRICE_RE) ?? [];
    const currencies = [
      ...new Set(signals.map((s) => s.replace(/[\d.,\s]/g, ""))),
    ];
    db.prepare(
      `INSERT INTO geo_probe (source_id, country, signal_count, top_signals, currency_set)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      sourceId,
      country,
      signals.length,
      JSON.stringify(signals.slice(0, 12)),
      JSON.stringify(currencies),
    );
    console.log(`[geo] ${url} · ${country}: ${signals.length} signals, currencies ${currencies.join(",") || "none"}`);
  }
}
