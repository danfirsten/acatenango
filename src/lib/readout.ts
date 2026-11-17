import type { IndexEntry } from '../../scripts/build-index';
import type { MarkKind } from '../components/ink/Mark';
import { en } from '../i18n/en';
import { formatNumber } from '../i18n/format';
import type { Dict } from '../i18n/types';

/**
 * The numbers the page shows, derived in one place.
 *
 * The React page and the single-file standalone build both render these. They
 * used to compute them separately and drifted: the standalone picked the
 * paroxysm by peak explosion rate, which is exactly wrong, because a paroxysm
 * publishes no per-hour rate at all.
 */

/** Fuego's summit — the datum an ash column height is quoted against. */
export const SUMMIT_M = 3763;

/**
 * The state of one value, shown everywhere with the same mark and words
 * (docs/design.md, "Marks: missing is never zero"):
 * - reported: the figure as the bulletin wrote it;
 * - saidNone: the bulletin speaks to it but names none (ash fall with no towns);
 * - notReported: the bulletin left it out, never drawn or counted as 0;
 * - held: left out, and the scene shows an earlier day's figure, named;
 * - continuous: emission with no hourly count.
 */
export type ValueState = 'reported' | 'saidNone' | 'notReported' | 'held' | 'continuous';

/** The five states in the order the key lists them. */
export const VALUE_STATES: ValueState[] = ['reported', 'saidNone', 'notReported', 'held', 'continuous'];

/** The ink and paper mark for each state. */
export const STATE_MARK: Record<ValueState, MarkKind> = {
  reported: 'solid',
  saidNone: 'ring',
  notReported: 'hatched',
  held: 'dotted',
  continuous: 'half',
};

/** The day fields the record shows. */
export type DayField = 'rate' | 'column' | 'drift' | 'glow' | 'drainages' | 'towns';

/**
 * What a bulletin said about one field, decided in one place so the readout,
 * the chart, the lanes and the camp panel never disagree. An empty list is the
 * parser's "nothing named", so it is not reported; the one "said none" the
 * parser can see is ash fall described with no town named.
 */
export function fieldState(e: IndexEntry, field: DayField): ValueState {
  switch (field) {
    case 'rate':
      return e.explosionsMax !== null ? 'reported'
        : e.phenomena.includes('continuousPhase') ? 'continuous' : 'notReported';
    case 'column':
      return e.ashMaxMasl !== null ? 'reported' : 'notReported';
    case 'drift':
      return e.driftDirections.length > 0 || e.driftKm !== null ? 'reported' : 'notReported';
    case 'glow':
      return e.incandescenceMaxM !== null ? 'reported' : 'notReported';
    case 'drainages':
      return e.drainages.length > 0 ? 'reported' : 'notReported';
    case 'towns':
      return e.ashfallCommunities.length > 0 ? 'reported'
        : e.phenomena.includes('ashfall') ? 'saidNone' : 'notReported';
  }
}

export interface ReadoutRow {
  key: string;
  value: string;
  unit: string;
  /** The headline figure, given visual weight. */
  lead?: boolean;
  /** The bulletin did not state this value (not reported, or held from an earlier day). */
  missing?: boolean;
  /** Which of the five marks the value carries. */
  state: ValueState;
}

/** Earlier days the scene holds a left-out value from, as display dates. */
export interface Held {
  rate?: string | null;
  column?: string | null;
}

/** "6–11", or just "11" when the bulletin gave only an upper figure. */
export function rateText(min: number | null, max: number): string {
  return min === null || min === max ? String(max) : `${min}–${max}`;
}

/**
 * The most violent day in the record, by ash column height, or -1 when no day
 * reported a column.
 *
 * Explosion rate is the wrong measure: during a paroxysm the bulletin stops
 * counting discrete explosions and describes continuous emission, so ranking by
 * rate skips the very days it is meant to find.
 */
export function paroxysmIndex(series: IndexEntry[]): number {
  let best = -1;
  series.forEach((e, i) => {
    if (e.ashMaxMasl === null) return;
    if (best === -1 || e.ashMaxMasl > (series[best].ashMaxMasl as number)) best = i;
  });
  return best;
}

/** A maximum taken only over the days that reported the field. */
export interface ReportedMax {
  /** Null when no day reported it. Never 0 standing in for missing. */
  value: number | null;
  /** How many days the maximum was taken over. */
  days: number;
}

function reportedMax(values: Array<number | null>): ReportedMax {
  const reported = values.filter((v): v is number => v !== null);
  return { value: reported.length > 0 ? Math.max(...reported) : null, days: reported.length };
}

/** The record's summary figures, ignoring days that left a field out. */
export function summaryFigures(series: IndexEntry[]): { tallestColumn: ReportedMax; peakRate: ReportedMax } {
  return {
    tallestColumn: reportedMax(series.map((e) => e.ashMaxMasl)),
    peakRate: reportedMax(series.map((e) => e.explosionsMax)),
  };
}

/** A stretch of consecutive days, `start` to `end` inclusive. */
export interface DayRun {
  start: number;
  end: number;
}

/**
 * Splits the explosion-rate series into runs of reported days, gaps where the
 * bulletin gave no rate, and continuous-emission stretches, which publish no
 * hourly count by nature. The chart draws a line through each reported run and
 * never bridges or zeroes the rest. Continuous days are kept apart from missing
 * ones: they are the volcano at its most active, not a hole in the record.
 */
export function rateRuns(series: IndexEntry[]): { reported: DayRun[]; missing: DayRun[]; continuous: DayRun[] } {
  const reported: DayRun[] = [];
  const missing: DayRun[] = [];
  const continuous: DayRun[] = [];
  series.forEach((e, i) => {
    const runs = e.explosionsMax !== null
      ? reported
      : e.phenomena.includes('continuousPhase') ? continuous : missing;
    const last = runs.at(-1);
    if (last && last.end === i - 1) last.end = i;
    else runs.push({ start: i, end: i });
  });
  return { reported, missing, continuous };
}

/** Days covered by a list of runs. */
export function runDays(runs: DayRun[]): number {
  return runs.reduce((n, r) => n + r.end - r.start + 1, 0);
}

/**
 * The latest day at or before `i` that reported a value for `pick` (by default
 * the explosion rate), or -1 if none did. Returns `i` itself when it reported.
 * The mountain uses it to hold a value the selected day left out.
 */
export function lastReportedIndex(
  series: IndexEntry[],
  i: number,
  pick: (e: IndexEntry) => number | null = (e) => e.explosionsMax,
): number {
  for (let j = Math.min(i, series.length - 1); j >= 0; j--) {
    if (pick(series[j]) !== null) return j;
  }
  return -1;
}

/**
 * The readout beside the mountain, in the dictionary's language (English by
 * default). `held` names the earlier day the scene holds a left-out rate or
 * column from, so the row itself says the plume is not this day's.
 */
export function readoutRows(day: IndexEntry, t: Dict = en, held: Held = {}): ReadoutRow[] {
  const r = t.readout;
  const num = (n: number) => formatNumber(t.locale, n);
  const dirs = day.driftDirections.map((d) => t.compassAbbr[d] ?? d).join('·');
  const aboveSummit = day.ashMaxMasl === null ? null : day.ashMaxMasl - SUMMIT_M;
  const missing = (key: string, from?: string | null, lead?: boolean): ReadoutRow => (from
    // Left out, and the scene holds an earlier day: said with the key's word for the dotted ring.
    ? { key, value: t.marks.word.held, unit: r.plumeShows(from), missing: true, state: 'held', ...(lead && { lead }) }
    : { key, value: r.notReported, unit: '', missing: true, state: 'notReported', ...(lead && { lead }) });

  const rate = fieldState(day, 'rate');
  const rows: ReadoutRow[] = [
    rate === 'reported'
      ? { key: r.explosions, value: rateText(day.explosionsMin, day.explosionsMax as number), unit: r.perHour, lead: true, state: rate }
      : rate === 'continuous'
        ? { key: r.explosions, value: r.continuous, unit: r.emission, lead: true, state: rate }
        : missing(r.explosions, held.rate, true),
    day.ashMaxMasl === null
      ? missing(r.ashColumn, held.column)
      : { key: r.ashColumn, value: num(day.ashMaxMasl), unit: r.mAsl, state: 'reported' },
    aboveSummit === null
      ? missing(r.aboveSummit, held.column)
      : { key: r.aboveSummit, value: num(aboveSummit), unit: r.metres, state: 'reported' },
    day.driftKm === null
      ? { key: r.drift, value: r.notReported, unit: day.driftDirections.length > 0 ? r.heading(dirs) : '', missing: true, state: 'notReported' }
      : { key: r.drift, value: num(day.driftKm), unit: r.km(dirs), state: 'reported' },
  ];

  // Named communities beat drainage counts when the observer gave us names.
  const towns = fieldState(day, 'towns');
  rows.push(
    towns === 'reported'
      ? { key: r.ashfallIn, value: String(day.ashfallCommunities.length), unit: day.ashfallCommunities.join(', '), state: towns }
      : day.drainages.length > 0
        ? { key: r.drainages, value: String(day.drainages.length), unit: day.drainages.join(', '), state: 'reported' }
        : towns === 'saidNone'
          // Ash fall described, no town named: a statement, not a gap.
          ? { key: r.ashfall, value: r.noneNamed, unit: '', state: towns }
          // An empty list means the bulletin named none, not that there were 0:
          // said the way the record's drainage lane says it.
          : { key: r.drainages, value: r.notReported, unit: '', missing: true, state: 'notReported' },
  );

  return rows;
}

/** Evenly spaced label positions for a chart's x-axis, deduplicated. */
export function axisLabelIndices(count: number): number[] {
  if (count <= 0) return [];
  const last = count - 1;
  return [...new Set([0, Math.floor(last / 3), Math.floor((last * 2) / 3), last])];
}

/** Space at the left of the record's plots for their scale labels, in CSS pixels. */
export const PLOT_GUTTER = 28;

/** Where day `i` of `count` sits on a plot `width` pixels wide, past the gutter. */
export function plotX(i: number, count: number, width: number): number {
  const w = width - PLOT_GUTTER;
  return PLOT_GUTTER + (count > 1 ? (i * w) / (count - 1) : w / 2);
}

/** The day nearest to an x on a plot `width` pixels wide. */
export function plotDayAt(x: number, count: number, width: number): number {
  if (count <= 1) return 0;
  const f = (x - PLOT_GUTTER) / (width - PLOT_GUTTER);
  return Math.max(0, Math.min(count - 1, Math.round(f * (count - 1))));
}
