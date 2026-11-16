/**
 * Rolls the per-day bulletin archive up into a single compact time series that
 * the site reads at build time.
 *
 * Kept separate from collection so the index can be rebuilt from the archive at
 * any time — including after a parser improvement, which re-derives every day
 * from its preserved raw text.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Bulletin } from '../src/lib/bulletin';
import { PARSER_VERSION } from '../src/lib/bulletin';
import { type Gap, parseGaps } from '../src/lib/gaps';
import { parseBulletin } from '../src/lib/parse-bulletin';

const BULLETIN_DIR = path.join(process.cwd(), 'data', 'bulletins');
const INDEX_PATH = path.join(process.cwd(), 'data', 'index.json');
const GAPS_PATH = path.join(process.cwd(), 'data', 'gaps.json');

export interface IndexEntry {
  date: string;
  explosionsMin: number | null;
  explosionsMax: number | null;
  ashMinMasl: number | null;
  ashMaxMasl: number | null;
  driftKm: number | null;
  driftDirections: string[];
  drainages: string[];
  lavaFlowM: number | null;
  phenomena: string[];
  /** Communities the bulletin named as taking ashfall. */
  ashfallCommunities: string[];
  /** Warnings from the parse, so the page can show what it could not read. */
  warnings: string[];
}

export interface FuegoIndex {
  generatedAt: string;
  parserVersion: number;
  /** Days present in the archive, oldest first. */
  entries: IndexEntry[];
  /** Days with no bulletin that INSIVUMEH no longer serves; the chart marks them "no bulletin". */
  gaps: Gap[];
  stats: {
    days: number;
    firstDate: string | null;
    lastDate: string | null;
    /** Days the parser could not fully read — genuine failures. */
    daysWithWarnings: number;
    /**
     * Days in a continuous eruptive phase. These publish no per-hour count at
     * all, so a null rate is the volcano's state rather than a parse failure.
     */
    daysContinuous: number;
  };
}

function toEntry(b: Bulletin): IndexEntry {
  // Re-parse from raw so a stale record picks up parser improvements for free.
  // Re-derive from the preserved raw text whenever the parser has moved on.
  const re =
    b.parserVersion === PARSER_VERSION
      ? { parsed: b.parsed, warnings: b.warnings }
      : parseBulletin(b.raw);
  const { parsed, warnings } = re;

  return {
    date: b.date,
    explosionsMin: parsed.explosionsPerHour?.min ?? null,
    explosionsMax: parsed.explosionsPerHour?.max ?? null,
    ashMinMasl: parsed.ashColumnMasl?.min ?? null,
    ashMaxMasl: parsed.ashColumnMasl?.max ?? null,
    driftKm: parsed.driftKm,
    driftDirections: parsed.driftDirections,
    drainages: parsed.drainages,
    lavaFlowM: parsed.lavaFlowM,
    phenomena: parsed.phenomena,
    ashfallCommunities: parsed.ashfallCommunities,
    warnings,
  };
}

export async function buildIndex(): Promise<FuegoIndex> {
  let files: string[] = [];
  try {
    files = (await readdir(BULLETIN_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    // No archive yet — emit a valid empty index so the site still builds.
  }

  const entries: IndexEntry[] = [];
  for (const file of files.sort()) {
    const full = path.join(BULLETIN_DIR, file);
    try {
      const bulletin = JSON.parse(await readFile(full, 'utf8')) as Bulletin;
      entries.push(toEntry(bulletin));
    } catch (err) {
      console.warn(`[index] skipping unreadable ${file}: ${String(err)}`);
    }
  }

  let gaps: Gap[] = [];
  try {
    const have = new Set(entries.map((e) => e.date));
    gaps = parseGaps(await readFile(GAPS_PATH, 'utf8')).filter((g) => !have.has(g.date));
  } catch {
    // No gaps file yet.
  }

  return {
    generatedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
    entries,
    gaps,
    stats: {
      days: entries.length,
      firstDate: entries[0]?.date ?? null,
      lastDate: entries.at(-1)?.date ?? null,
      daysWithWarnings: entries.filter((e) => e.warnings.length > 0).length,
      daysContinuous: entries.filter((e) => e.phenomena.includes('continuousPhase')).length,
    },
  };
}

async function main(): Promise<void> {
  const index = await buildIndex();
  await mkdir(path.dirname(INDEX_PATH), { recursive: true });
  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(
    `[index] ${index.stats.days} days ` +
      `(${index.stats.firstDate ?? '—'} → ${index.stats.lastDate ?? '—'}), ` +
      `${index.stats.daysWithWarnings} with warnings, ` +
      `${index.stats.daysContinuous} in a continuous phase`,
  );
}

// Only run when invoked directly, so tests can import buildIndex().
if (process.argv[1]?.endsWith('build-index.ts')) {
  main().catch((err) => {
    console.error('[index] failed:', err);
    process.exitCode = 1;
  });
}
