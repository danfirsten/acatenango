import type { Range } from './bulletin';

/**
 * Smithsonian Global Volcanism Program weekly reports for Fuego (volcano 342090),
 * read as a cross-check on the INSIVUMEH bulletins.
 *
 * GVP summarises INSIVUMEH's own reporting, so the two should agree. When they
 * clearly do not, either the parser, the OCR or the summary slipped, and the
 * page marks that week quietly. Neither source is treated as the truth, and
 * nothing is corrected.
 *
 * Pure and free of node:fs and fetch, so the collector, the index build and the
 * tests share it.
 */

export const GVP_PARSER_VERSION = 1;
export const GVP_VOLCANO = 342090;

export interface GvpParsed {
  /** Explosions per hour the week's report states; null when it states none. */
  explosionsPerHour: Range | null;
  /** Ash plume altitude in metres above sea level; null when none is stated in those terms. */
  ashColumnMasl: Range | null;
}

/** One stored weekly report, `data/gvp/<week>.json`. Raw text is kept verbatim. */
export interface GvpRecord {
  /** First day (a Wednesday, UTC) of the week the report covers. */
  week: string;
  url: string;
  fetchedAt: string;
  raw: string;
  parsed: GvpParsed;
  parserVersion: number;
  warnings: string[];
}

export type GvpState = 'agree' | 'differ' | 'unchecked';

export interface GvpCheck {
  field: 'explosions' | 'ash';
  gvp: Range | null;
  bulletins: Range | null;
  /** Days in the week whose bulletin stated the field. */
  days: number;
  /** Both sides stated it and the ranges clearly disagree. */
  differs: boolean;
}

/** What a week of the record says about the two sources. */
export interface GvpMark {
  week: string;
  /** Last day of the week, YYYY-MM-DD. */
  end: string;
  state: GvpState;
  url: string;
  checks: GvpCheck[];
  /** The week's bulletins, for linking the other source. */
  bulletins: Array<{ date: string; url: string }>;
}

/** The slim form every day carries; the full mark sits on the week's first day. */
export interface GvpDay {
  week: string;
  state: GvpState;
  mark?: GvpMark;
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const time = (d: string) => Date.parse(`${d}T00:00:00Z`);

export function addDays(date: string, n: number): string {
  return iso(time(date) + n * DAY);
}

/** GVP weeks run Wednesday to Tuesday; the Wednesday on or before `date`. */
export function weekStart(date: string): string {
  const dow = new Date(time(date)).getUTCDay();
  return addDays(date, -((dow - 3 + 7) % 7));
}

/** Week starts whose report is out by `to` (a report appears the Wednesday after its week). */
export function weekStarts(from: string, to: string): string[] {
  const out: string[] = [];
  for (let w = weekStart(from); addDays(w, 7) <= to; w = addDays(w, 7)) out.push(w);
  return out;
}

/** The report page for the week starting `week`: GVP's DOI is dated the day it is released. */
export function reportUrl(week: string): string {
  const released = addDays(week, 7).replaceAll('-', '');
  return `https://volcano.si.edu/showreport.cfm?doi=GVP.WVAR${released}-${GVP_VOLCANO}`;
}

const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;
const SEP = String.raw`(?:-|–|—|to)`;
const num = (s: string) => Number(s.replaceAll(',', ''));

function span(a: string, b: string | undefined, scale = 1): Range {
  const lo = num(a) * scale;
  const hi = b === undefined ? lo : num(b) * scale;
  return { min: Math.round(Math.min(lo, hi)), max: Math.round(Math.max(lo, hi)) };
}

function union(ranges: Range[]): Range | null {
  if (ranges.length === 0) return null;
  return { min: Math.min(...ranges.map((r) => r.min)), max: Math.max(...ranges.map((r) => r.max)) };
}

/**
 * Reads the figures a weekly report states. Only what is stated in these terms
 * is taken: a plume given as "above the crater" is not turned into an altitude,
 * and a field the text does not state is null, never 0.
 */
export function parseGvp(raw: string): { parsed: GvpParsed; warnings: string[] } {
  const text = raw.replace(/\s+/g, ' ');

  const rates: Range[] = [];
  const rateRe = new RegExp(
    String.raw`(${NUM})(?:\s*${SEP}\s*(${NUM}))?\s*(?:explosions?\s+)?(?:per|/)\s*hour`, 'gi',
  );
  for (const m of text.matchAll(rateRe)) rates.push(span(m[1], m[2]));

  const heights: Range[] = [];
  const unit = String.raw`(?:\s*\([^)]*\))?\s*(?:a\.s\.l\.?|asl|altitude|above sea level)`;
  const kmRe = new RegExp(String.raw`(${NUM})(?:\s*${SEP}\s*(${NUM}))?\s*km${unit}`, 'gi');
  const mRe = new RegExp(String.raw`(${NUM})(?:\s*${SEP}\s*(${NUM}))?\s*m${unit}`, 'gi');
  for (const m of text.matchAll(kmRe)) heights.push(span(m[1], m[2], 1000));
  for (const m of text.matchAll(mRe)) heights.push(span(m[1], m[2]));
  // Fuego's summit is 3,763 m; a plume altitude outside this window is a misread, not a figure.
  const plausible = heights.filter((r) => r.min >= 3000 && r.max <= 9000);

  const parsed: GvpParsed = { explosionsPerHour: union(rates), ashColumnMasl: union(plausible) };
  const warnings: string[] = [];
  if (!parsed.explosionsPerHour) warnings.push('explosionsPerHour');
  if (!parsed.ashColumnMasl) warnings.push('ashColumnMasl');
  return { parsed, warnings };
}

/**
 * The report's own words from a GVP report page: from "Report for" to the
 * "Sources" line. Verbatim, apart from the markup stripped by the caller.
 */
export function reportText(pageText: string): string | null {
  const start = pageText.search(/Report for\s+\d/i);
  if (start === -1) return null;
  const body = pageText.slice(start);
  const end = body.search(/\n\s*(?:Sources?:|Geologic Background)/i);
  return (end === -1 ? body : body.slice(0, end)).trim();
}

/** A gap wider than this counts as a clear disagreement. */
const TOLERANCE = {
  explosions: (a: Range, b: Range) => Math.max(2, 0.25 * Math.max(a.max, b.max)),
  ash: () => 500,
} as const;

/** True when the ranges do not overlap and sit further apart than the field's tolerance. */
export function clearlyDisagree(field: 'explosions' | 'ash', a: Range, b: Range): boolean {
  const gap = Math.max(a.min - b.max, b.min - a.max);
  return gap > TOLERANCE[field](a, b);
}

export interface DayFigures {
  date: string;
  url: string;
  explosionsMin: number | null;
  explosionsMax: number | null;
  ashMinMasl: number | null;
  ashMaxMasl: number | null;
}

const rangeOf = (days: DayFigures[], lo: 'explosionsMin' | 'ashMinMasl', hi: 'explosionsMax' | 'ashMaxMasl') =>
  union(days.flatMap((d) => (d[lo] === null || d[hi] === null ? [] : [{ min: d[lo], max: d[hi] }])));

/**
 * Compares one week's GVP figures with the bulletins of the same seven days.
 * A field either side leaves out is not compared: it cannot disagree.
 */
export function compareWeek(record: GvpRecord, days: DayFigures[]): GvpMark {
  const end = addDays(record.week, 6);
  const inWeek = days.filter((d) => d.date >= record.week && d.date <= end);
  const field = (
    name: 'explosions' | 'ash', gvp: Range | null, lo: 'explosionsMin' | 'ashMinMasl', hi: 'explosionsMax' | 'ashMaxMasl',
  ): GvpCheck => {
    const bulletins = rangeOf(inWeek, lo, hi);
    return {
      field: name,
      gvp,
      bulletins,
      days: inWeek.filter((d) => d[lo] !== null && d[hi] !== null).length,
      differs: gvp !== null && bulletins !== null && clearlyDisagree(name, gvp, bulletins),
    };
  };
  const checks = [
    field('explosions', record.parsed.explosionsPerHour, 'explosionsMin', 'explosionsMax'),
    field('ash', record.parsed.ashColumnMasl, 'ashMinMasl', 'ashMaxMasl'),
  ];
  const compared = checks.some((c) => c.gvp !== null && c.bulletins !== null);
  return {
    week: record.week,
    end,
    state: checks.some((c) => c.differs) ? 'differ' : compared ? 'agree' : 'unchecked',
    url: record.url,
    checks,
    bulletins: inWeek.map((d) => ({ date: d.date, url: d.url })),
  };
}

/** Reads a stored record leniently; a malformed file is dropped, never thrown. */
export function parseGvpRecord(text: string): GvpRecord | null {
  try {
    const r = JSON.parse(text) as Partial<GvpRecord>;
    if (typeof r.week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.week)) return null;
    if (typeof r.raw !== 'string' || typeof r.url !== 'string') return null;
    return r as GvpRecord;
  } catch {
    return null;
  }
}
