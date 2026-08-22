/**
 * Fetches the day's INSIVUMEH bulletin for Volcán de Fuego, parses it, and
 * archives it as JSON under data/bulletins/.
 *
 * Run by .github/workflows/collect.yml on a schedule. The repository is the
 * database: every run is a commit, so the git history *is* the time series.
 *
 * The script is deliberately tolerant. A failed fetch or an unparseable
 * bulletin exits 0 with a warning rather than failing the workflow — a missed
 * day is a gap, but a red workflow that gets muted is a permanent outage.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Bulletin } from '../src/lib/bulletin';
import { guatemalaDate } from '../src/lib/date';
import { bvdUrl, recentDates } from '../src/lib/bvd';
import { fetchWithRetry } from '../src/lib/fetch-text';
import { ocrAvailable, ocrFuegoPage } from './ocr';
import { parseBulletin } from '../src/lib/parse-bulletin';

const DATA_DIR = path.join(process.cwd(), 'data', 'bulletins');
/** How many days back to look when today's bulletin is not up yet. */
const LOOKBACK_DAYS = 4;

/**
 * Resolves the most recent published bulletin, walking back from `from`.
 * Returns the date it belongs to as well as its URL — a bulletin fetched on the
 * 22nd may well be the 21st's, and it must be archived under its own date.
 */
async function resolveBulletin(
  from: string,
): Promise<{ date: string; url: string; raw: string } | null> {
  for (const date of recentDates(from, LOOKBACK_DAYS)) {
    const url = bvdUrl(date);
    try {
      const res = await fetchWithRetry(url);
      const pdf = Buffer.from(await res.arrayBuffer());
      const raw = await ocrFuegoPage(pdf);
      if (!raw) {
        console.warn(`[collect] ${date}: no Volcán de Fuego page found in the bulletin`);
        continue;
      }
      return { date, url, raw };
    } catch {
      // Not published for that date; try the day before.
    }
  }
  return null;
}

async function main(): Promise<void> {
  const today = guatemalaDate();

  if (!(await ocrAvailable())) {
    console.error('[collect] pdftoppm and tesseract are required — see README');
    process.exitCode = 1;
    return;
  }

  const override = process.env.BULLETIN_URL;
  const found = override
    ? await (async () => {
        const pdf = Buffer.from(await (await fetchWithRetry(override)).arrayBuffer());
        return { date: today, url: override, raw: (await ocrFuegoPage(pdf)) ?? '' };
      })()
    : await resolveBulletin(today);

  if (!found) {
    console.warn(`[collect] no bulletin published in the last ${LOOKBACK_DAYS} days`);
    return;
  }
  const { date, url, raw } = found;
  console.log(`[collect] source: ${url}`);

  // A near-empty page means OCR failed on the scan. Archiving it would let
  // build-index count the day as collected when nothing was actually read.
  if (raw.trim().length < 80) {
    console.warn(`[collect] OCR returned ${raw.length} chars for ${url}; nothing archived`);
    return;
  }

  const outPath = path.join(DATA_DIR, `${date}.json`);
  const { parsed, warnings, parserVersion } = parseBulletin(raw);

  // Never replace a record that parsed cleanly with one that did not; a
  // mid-day re-run should not degrade the archive.
  const existing = await readBulletin(outPath);
  if (existing && existing.warnings.length < warnings.length) {
    console.log('[collect] keeping existing record — it parsed more completely');
    return;
  }

  const bulletin: Bulletin = {
    date,
    source: 'insivumeh',
    url,
    fetchedAt: new Date().toISOString(),
    raw,
    parsed,
    parserVersion,
    warnings,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(outPath, `${JSON.stringify(bulletin, null, 2)}\n`, 'utf8');

  console.log(`[collect] wrote ${outPath}`);
  console.log(`[collect] explosions/hr: ${format(parsed.explosionsPerHour)}`);
  console.log(`[collect] ash column masl: ${format(parsed.ashColumnMasl)}`);
  console.log(`[collect] drift: ${parsed.driftDirections.join(',') || '—'} ${parsed.driftKm ?? '—'}km`);
  console.log(`[collect] sky: ${parsed.sky ?? '—'}`);
  if (warnings.length > 0) console.warn(`[collect] warnings: ${warnings.join(', ')}`);
}

function format(r: { min: number; max: number } | null): string {
  if (!r) return '—';
  return r.min === r.max ? String(r.min) : `${r.min}–${r.max}`;
}

async function readBulletin(file: string): Promise<Bulletin | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Bulletin;
  } catch {
    return null;
  }
}

// Only run when invoked directly, so tests can import the helpers above
// without triggering a network fetch.
if (process.argv[1]?.endsWith('collect.ts')) {
  main().catch((err) => {
    console.error('[collect] unexpected failure:', err);
    process.exitCode = 1;
  });
}
