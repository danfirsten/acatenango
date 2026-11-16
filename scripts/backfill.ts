/**
 * Walks back through published bulletins and archives every day it can find.
 *
 * Only possible because the bulletins are date-addressable: there is no archive
 * page to crawl, just a URL per day. Days already on disk are skipped, so this
 * is safe to re-run and cheap to resume.
 *
 *   npm run backfill -- 90
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Bulletin } from '../src/lib/bulletin';
import { bvdUrl, recentDates } from '../src/lib/bvd';
import { guatemalaDate } from '../src/lib/date';
import { fetchWithRetry } from '../src/lib/fetch-text';
import { parseBulletin } from '../src/lib/parse-bulletin';
import { documentMentionsDate } from '../src/lib/ocr';
import { ocrAvailable, ocrBulletin } from './ocr';

const DATA_DIR = path.join(process.cwd(), 'data', 'bulletins');

async function alreadyHave(file: string): Promise<boolean> {
  try {
    const b = JSON.parse(await readFile(file, 'utf8')) as Bulletin;
    return b.raw.trim().length > 80;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!(await ocrAvailable())) {
    console.error('[backfill] pdftoppm and tesseract are required — see README');
    process.exitCode = 1;
    return;
  }

  const days = Number(process.argv[2] ?? 90);
  const dates = recentDates(guatemalaDate(), days);
  await mkdir(DATA_DIR, { recursive: true });

  let written = 0, skipped = 0, missing = 0, failed = 0;

  for (const date of dates) {
    const out = path.join(DATA_DIR, `${date}.json`);
    if (await alreadyHave(out)) { skipped++; continue; }

    const url = bvdUrl(date);
    try {
      const res = await fetchWithRetry(url, 2);
      const pdf = Buffer.from(await res.arrayBuffer());
      const { fuego: raw, pages } = await ocrBulletin(pdf);
      if (!raw || raw.trim().length < 80) {
        console.warn(`[backfill] ${date}: no readable Fuego page`);
        failed++;
        continue;
      }
      if (!documentMentionsDate(pages, date)) {
        console.warn(`[backfill] ${date}: document names another date — skipped`);
        failed++;
        continue;
      }

      const { parsed, warnings, parserVersion } = parseBulletin(raw);
      const bulletin: Bulletin = {
        date, source: 'insivumeh', url,
        fetchedAt: new Date().toISOString(),
        raw, parsed, parserVersion, warnings,
      };
      await writeFile(out, `${JSON.stringify(bulletin, null, 2)}\n`, 'utf8');
      written++;

      const r = parsed.explosionsPerHour;
      console.log(
        `[backfill] ${date}  ${r ? `${r.min}-${r.max}/hr` : '—'}` +
        `  ash ${parsed.ashColumnMasl?.max ?? '—'}` +
        `  ${parsed.sky ?? '—'}` +
        `${warnings.length ? `  ⚠ ${warnings.join(',')}` : ''}`,
      );
    } catch {
      // No bulletin published that day (weekends and holidays have gaps).
      missing++;
    }
  }

  console.log(`[backfill] ${written} written, ${skipped} already held, ${missing} not published, ${failed} unreadable`);
}

main().catch((err) => { console.error('[backfill] failed:', err); process.exitCode = 1; });
