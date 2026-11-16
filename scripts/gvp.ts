/**
 * Fetches the Smithsonian GVP weekly reports for Fuego and archives each as
 * JSON under data/gvp/, beside the bulletins.
 *
 *   tsx scripts/gvp.ts            every week since the first bulletin (backfill)
 *   tsx scripts/gvp.ts --recent   the last four weeks (the scheduled run)
 *
 * Like the bulletin collector it is tolerant: a week GVP has not published, or a
 * fetch that fails, is a warning and exit 0. A week already stored with the
 * current parser is left alone; one stored by an older parser is re-read from
 * its raw text with no fetch.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { guatemalaDate } from '../src/lib/date';
import { fetchWithRetry, htmlToText } from '../src/lib/fetch-text';
import {
  GVP_PARSER_VERSION,
  type GvpRecord,
  addDays,
  parseGvp,
  parseGvpRecord,
  reportText,
  reportUrl,
  weekStarts,
} from '../src/lib/gvp';

export const GVP_DIR = path.join(process.cwd(), 'data', 'gvp');
const BULLETIN_DIR = path.join(process.cwd(), 'data', 'bulletins');

/** Returns a report page's HTML, or null when GVP has no report at that address. */
export type PageFetcher = (url: string) => Promise<string | null>;

export const fetchPage: PageFetcher = async (url) => {
  try {
    return await (await fetchWithRetry(url, 3)).text();
  } catch (err) {
    // A 404 is a week with no report; anything else is worth a warning, and also a skip.
    if (!/returned 404/.test(String(err))) console.warn(`[gvp] ${url}: ${String(err)}`);
    return null;
  }
};

/** Builds the record for one week from its page, or null when the page holds no report for it. */
export function recordFromPage(week: string, html: string, fetchedAt: string): GvpRecord | null {
  const raw = reportText(htmlToText(html));
  if (!raw) return null;
  // The page must say it covers this week, so a redirect to another report is not filed under it.
  const first = new Date(`${week}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  if (!new RegExp(`(?<!\\d)${first}`).test(raw.slice(0, 120))) return null;
  const { parsed, warnings } = parseGvp(raw);
  return { week, url: reportUrl(week), fetchedAt, raw, parsed, parserVersion: GVP_PARSER_VERSION, warnings };
}

async function stored(week: string, dir: string): Promise<GvpRecord | null> {
  try {
    return parseGvpRecord(await readFile(path.join(dir, `${week}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function write(record: GvpRecord, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${record.week}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

export interface CollectResult {
  written: string[];
  reparsed: string[];
  missing: string[];
}

/** Collects the given weeks. `fetcher` and `now` are injectable so tests run offline. */
export async function collectWeeks(
  weeks: string[],
  fetcher: PageFetcher = fetchPage,
  now: () => string = () => new Date().toISOString(),
  dir: string = GVP_DIR,
): Promise<CollectResult> {
  const result: CollectResult = { written: [], reparsed: [], missing: [] };
  for (const week of weeks) {
    const have = await stored(week, dir);
    if (have && have.parserVersion === GVP_PARSER_VERSION) continue;
    if (have) {
      const { parsed, warnings } = parseGvp(have.raw);
      await write({ ...have, parsed, warnings, parserVersion: GVP_PARSER_VERSION }, dir);
      result.reparsed.push(week);
      continue;
    }
    const html = await fetcher(reportUrl(week));
    const record = html === null ? null : recordFromPage(week, html, now());
    if (!record) {
      result.missing.push(week);
      continue;
    }
    await write(record, dir);
    result.written.push(week);
  }
  return result;
}

async function firstBulletinDate(): Promise<string | null> {
  try {
    const files = (await readdir(BULLETIN_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    return files[0]?.slice(0, 10) ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const today = guatemalaDate();
  const recent = process.argv.includes('--recent');
  const from = recent ? addDays(today, -28) : await firstBulletinDate();
  if (!from) {
    console.warn('[gvp] no bulletins archived yet; nothing to cross-check');
    return;
  }
  const weeks = weekStarts(from, today);
  const r = await collectWeeks(weeks);
  console.log(
    `[gvp] ${weeks.length} weeks: ${r.written.length} new, ${r.reparsed.length} re-read, ` +
      `${r.missing.length} not available`,
  );
}

// Only run when invoked directly, so tests can import collectWeeks().
if (process.argv[1]?.endsWith('gvp.ts')) {
  main().catch((err) => {
    console.error('[gvp] unexpected failure:', err);
    process.exitCode = 1;
  });
}
