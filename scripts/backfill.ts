/**
 * Archives every missing day between two dates, and records the days INSIVUMEH
 * no longer serves in data/gaps.json.
 *
 * Only possible because the bulletins are date-addressable: there is no archive
 * page to crawl, just a URL per day. Days already on disk are skipped, so this
 * is safe to re-run and cheap to resume.
 *
 *   npm run backfill                              first record to today
 *   npm run backfill -- 90                        the last 90 days
 *   npm run backfill -- --from 2026-10-12 --to 2026-10-30
 *   npm run backfill -- --recheck                 also retry recorded gaps
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Bulletin } from '../src/lib/bulletin';
import { bvdUrl } from '../src/lib/bvd';
import { guatemalaDate } from '../src/lib/date';
import { fetchWithRetry } from '../src/lib/fetch-text';
import { type Gap, isDefinitelyAbsent, mergeGaps, missingDates, parseGaps, resolveRange, serializeGaps } from '../src/lib/gaps';
import { parseBulletin } from '../src/lib/parse-bulletin';
import { documentMentionsDate } from '../src/lib/ocr';
import { ocrAvailable, ocrBulletin } from './ocr';

const DATA_DIR = path.join(process.cwd(), 'data', 'bulletins');
const GAPS_PATH = path.join(process.cwd(), 'data', 'gaps.json');

async function heldDates(): Promise<string[]> {
  const out: string[] = [];
  let files: string[] = [];
  try { files = await readdir(DATA_DIR); } catch { return out; }
  for (const f of files.filter((n) => n.endsWith('.json')).sort()) {
    try {
      const b = JSON.parse(await readFile(path.join(DATA_DIR, f), 'utf8')) as Bulletin;
      if (b.raw.trim().length > 80) out.push(f.slice(0, -'.json'.length));
    } catch { /* unreadable record: treat as not held */ }
  }
  return out;
}

async function main(): Promise<void> {
  if (!(await ocrAvailable())) {
    console.error('[backfill] pdftoppm and tesseract are required — see README');
    process.exitCode = 1;
    return;
  }

  const today = guatemalaDate();
  const held = await heldDates();
  const { from, to } = resolveRange(process.argv.slice(2), today, held[0] ?? null);
  let existing: Gap[] = [];
  try { existing = parseGaps(await readFile(GAPS_PATH, 'utf8')); } catch { /* none yet */ }
  // Known gaps are not retried on every run (it would rewrite the file for
  // nothing); pass --recheck to try them again.
  const known = process.argv.includes('--recheck') ? [] : existing.map((g) => g.date);
  const todo = missingDates([...held, ...known], from, to);
  await mkdir(DATA_DIR, { recursive: true });
  console.log(`[backfill] ${from} → ${to}: ${todo.length} days to try`);

  const now = new Date().toISOString();
  const found: Gap[] = [];
  const recovered: string[] = [];
  const gap = (date: string, reason: string) => {
    // Today's bulletin may simply not be up yet, so it is not a gap.
    if (date < today) found.push({ date, reason, lastTried: now });
  };
  let written = 0;

  for (const date of todo) {
    const url = bvdUrl(date);
    let pdf: Buffer;
    try {
      pdf = Buffer.from(await (await fetchWithRetry(url, 2)).arrayBuffer());
    } catch (err) {
      if (isDefinitelyAbsent(err)) gap(date, 'INSIVUMEH no longer serves a bulletin for this date');
      else console.warn(`[backfill] ${date}: fetch failed (${String(err)}); not recorded, will retry next run`);
      continue;
    }
    try {
      const { fuego: raw, pages } = await ocrBulletin(pdf);
      if (!raw || raw.trim().length < 80) {
        console.warn(`[backfill] ${date}: no readable Fuego page`);
        gap(date, 'the bulletin has no readable Volcán de Fuego page');
        continue;
      }
      if (!documentMentionsDate(pages, date)) {
        console.warn(`[backfill] ${date}: document names another date — skipped`);
        gap(date, 'the file at this date holds a bulletin for another day');
        continue;
      }
      const { parsed, warnings, parserVersion } = parseBulletin(raw);
      const bulletin: Bulletin = {
        date, source: 'insivumeh', url,
        fetchedAt: new Date().toISOString(),
        raw, parsed, parserVersion, warnings,
      };
      await writeFile(path.join(DATA_DIR, `${date}.json`), `${JSON.stringify(bulletin, null, 2)}\n`, 'utf8');
      written++;
      recovered.push(date);
      const r = parsed.explosionsPerHour;
      console.log(
        `[backfill] ${date}  ${r ? `${r.min}-${r.max}/hr` : '—'}` +
        `  ash ${parsed.ashColumnMasl?.max ?? '—'}  ${parsed.sky ?? '—'}` +
        `${warnings.length ? `  ⚠ ${warnings.join(',')}` : ''}`,
      );
    } catch (err) {
      console.warn(`[backfill] ${date}: OCR failed: ${String(err)}`);
      // An OCR crash says nothing about the day, so it is retried, not recorded.
    }
  }

  const gaps = mergeGaps(existing, found, [...held, ...recovered]);
  if (found.length > 0 || recovered.length > 0) await writeFile(GAPS_PATH, serializeGaps(gaps), 'utf8');

  console.log(`[backfill] ${written} written, ${found.length} recorded as gaps, ${gaps.length} gaps in total`);
}

main().catch((err) => { console.error('[backfill] failed:', err); process.exitCode = 1; });
