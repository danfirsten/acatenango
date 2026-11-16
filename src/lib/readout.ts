import type { IndexEntry } from '../../scripts/build-index';

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

export interface ReadoutRow {
  key: string;
  value: string;
  unit: string;
  /** The headline figure, given visual weight. */
  lead?: boolean;
  /** The bulletin did not state this value. */
  missing?: boolean;
}

const NOT_REPORTED = 'Not reported';

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

export function readoutRows(day: IndexEntry): ReadoutRow[] {
  const continuous = day.phenomena.includes('continuousPhase');
  const aboveSummit = day.ashMaxMasl === null ? null : day.ashMaxMasl - SUMMIT_M;

  const rows: ReadoutRow[] = [
    day.explosionsMax === null
      ? continuous
        ? { key: 'Explosions', value: 'continuous', unit: 'emission', lead: true }
        : { key: 'Explosions', value: NOT_REPORTED, unit: '', lead: true, missing: true }
      : { key: 'Explosions', value: rateText(day.explosionsMin, day.explosionsMax), unit: 'per hour', lead: true },
    day.ashMaxMasl === null
      ? { key: 'Ash column', value: NOT_REPORTED, unit: '', missing: true }
      : { key: 'Ash column', value: day.ashMaxMasl.toLocaleString('en-GB'), unit: 'm asl' },
    aboveSummit === null
      ? { key: 'Above summit', value: NOT_REPORTED, unit: '', missing: true }
      : { key: 'Above summit', value: aboveSummit.toLocaleString('en-GB'), unit: 'm' },
    day.driftKm === null
      ? day.driftDirections.length > 0
        ? { key: 'Drift', value: NOT_REPORTED, unit: `heading ${day.driftDirections.join('·')}`, missing: true }
        : { key: 'Drift', value: NOT_REPORTED, unit: '', missing: true }
      : { key: 'Drift', value: String(day.driftKm), unit: `km ${day.driftDirections.join('·')}` },
  ];

  // Named communities beat drainage counts when the observer gave us names.
  rows.push(
    day.ashfallCommunities.length > 0
      ? {
          key: 'Ashfall named in',
          value: String(day.ashfallCommunities.length),
          unit: day.ashfallCommunities.join(', '),
        }
      : day.drainages.length > 0
        ? { key: 'Drainages', value: String(day.drainages.length), unit: day.drainages.join(', ') }
        // An empty list means the bulletin named none, not that there were 0.
        : { key: 'Drainages', value: 'None named', unit: '', missing: true },
  );

  return rows;
}

/** Evenly spaced label positions for a chart's x-axis, deduplicated. */
export function axisLabelIndices(count: number): number[] {
  if (count <= 0) return [];
  const last = count - 1;
  return [...new Set([0, Math.floor(last / 3), Math.floor((last * 2) / 3), last])];
}
