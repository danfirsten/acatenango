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
import { fetchDocumentText, fetchWithRetry, htmlToText } from '../src/lib/fetch-text';
import { parseBulletin } from '../src/lib/parse-bulletin';

const INSIVUMEH_ORIGIN = 'https://insivumeh.gob.gt';
const DATA_DIR = path.join(process.cwd(), 'data', 'bulletins');

/**
 * Finds today's Fuego bulletin. INSIVUMEH has reorganised its site before, so
 * try several entry points and score candidate links rather than depending on
 * one fixed URL shape.
 */
export function scoreBulletinLink(href: string, text: string): number {
  const haystack = `${href} ${text}`.toLowerCase();
  let score = 0;
  if (/fuego/.test(haystack)) score += 3;
  if (/bolet[ií]n|boletin|actualizaci[óo]n/.test(haystack)) score += 2;
  if (/vulcanolog/.test(haystack)) score += 2;
  if (/\.pdf$/.test(href.toLowerCase())) score += 1;
  // Bulletins for other volcanoes are near-misses we must not pick up.
  if (/santiaguito|pacaya|santa\s*mar[ií]a/.test(haystack)) score -= 5;
  return score;
}

export function extractLinks(html: string, base: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const url = new URL(m[1], base);
      // Ignore mailto:, javascript:, tel: and friends.
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      links.push({ href: url.toString(), text: htmlToText(m[2]) });
    } catch {
      // Unparseable href — skip it.
    }
  }
  return links;
}

async function discoverBulletinUrl(): Promise<string | null> {
  const entryPoints = [
    `${INSIVUMEH_ORIGIN}/`,
    `${INSIVUMEH_ORIGIN}/?p=137199`,
    `${INSIVUMEH_ORIGIN}/category/vulcanologia/`,
  ];

  const candidates: Array<{ href: string; score: number }> = [];
  for (const entry of entryPoints) {
    try {
      const res = await fetchWithRetry(entry);
      const html = await res.text();
      for (const link of extractLinks(html, entry)) {
        const score = scoreBulletinLink(link.href, link.text);
        if (score >= 4) candidates.push({ href: link.href, score });
      }
    } catch (err) {
      console.warn(`[collect] entry point failed: ${entry}: ${String(err)}`);
    }
    if (candidates.length > 0) break;
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].href;
}

async function main(): Promise<void> {
  const date = guatemalaDate();
  const outPath = path.join(DATA_DIR, `${date}.json`);

  const url = process.env.BULLETIN_URL ?? (await discoverBulletinUrl());
  if (!url) {
    console.warn('[collect] no bulletin link found; nothing archived today');
    return;
  }
  console.log(`[collect] source: ${url}`);

  let raw: string;
  try {
    raw = await fetchDocumentText(url);
  } catch (err) {
    console.warn(`[collect] fetch failed: ${String(err)}`);
    return;
  }

  if (raw.trim().length < 80) {
    console.warn(`[collect] document too short to be a bulletin (${raw.length} chars)`);
    return;
  }

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
