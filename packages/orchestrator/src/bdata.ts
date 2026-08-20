import { spawn } from "node:child_process";

export interface BdataResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface BdataOptions {
  timeoutMs?: number;
  retries?: number;
}

const DEFAULT_TIMEOUT = 5 * 60_000;

// Every Bright Data call goes through `npx -p @brightdata/cli` — nothing
// installed globally. One retry with backoff; the command line and exit code
// are logged so a disputed heal has evidence.
export async function bdata(
  args: string[],
  opts: BdataOptions = {},
): Promise<BdataResult> {
  const retries = opts.retries ?? 1;
  let last: BdataResult | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2000 * attempt);
    last = await runOnce(args, opts.timeoutMs ?? DEFAULT_TIMEOUT);
    console.log(
      `[bdata] ${args.join(" ")} -> exit ${last.exitCode} in ${last.durationMs}ms`,
    );
    if (last.ok) return last;
  }
  return last!;
}

function runOnce(args: string[], timeoutMs: number): Promise<BdataResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["-p", "@brightdata/cli", "bdata", ...args],
      { shell: process.platform === "win32" },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}

// Run output arrives as human-friendly text with a JSON payload embedded;
// take the outermost array or object.
export function extractJson(stdout: string): unknown {
  const start = Math.min(
    ...["[", "{"].map((c) => {
      const i = stdout.indexOf(c);
      return i === -1 ? Infinity : i;
    }),
  );
  if (!Number.isFinite(start)) throw new Error("no JSON in bdata output");
  const text = stdout.slice(start).trim();
  for (let end = text.length; end > 0; end--) {
    try {
      return JSON.parse(text.slice(0, end));
    } catch {
      /* keep shrinking */
    }
  }
  throw new Error("unparseable JSON in bdata output");
}

export function runScraper(
  collectorId: string,
  url: string,
  country?: string,
): Promise<BdataResult> {
  const args = ["scraper", "run", collectorId, url, "--json"];
  if (country) args.push("--country", country);
  return bdata(args, { timeoutMs: 10 * 60_000 });
}

export function healScraper(
  collectorId: string,
  prompt: string,
  url: string,
): Promise<BdataResult> {
  return bdata(["scraper", "heal", collectorId, prompt, "--url", url], {
    timeoutMs: 30 * 60_000,
    retries: 0,
  });
}

export function approveHeal(
  collectorId: string,
  url: string,
  reject: boolean,
): Promise<BdataResult> {
  const args = ["scraper", "approve", collectorId];
  if (reject) args.push("--reject");
  else args.push("--url", url);
  return bdata(args, { timeoutMs: 10 * 60_000, retries: 0 });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
