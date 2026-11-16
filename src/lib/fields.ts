import type { IndexEntry } from '../../scripts/build-index';

/**
 * What the field lanes show and say, derived in one place and kept free of
 * React and node:fs so the page, the tests and any other build can share it.
 *
 * A day that did not state a field is missing, never a 0: an empty list is the
 * parser's "nothing named", so it is drawn as missing and left out of every
 * count's denominator.
 */

/** Width of the shared x axis, in SVG units. The tempo chart uses the same. */
export const AXIS_W = 1000;

/** Where day `i` of `count` sits on the shared axis. Same rule as the tempo chart. */
export function dayX(i: number, count: number, width = AXIS_W): number {
  return count > 1 ? (i * width) / (count - 1) : width / 2;
}

/** The day nearest to an x on the axis (0 to AXIS_W). */
export function dayAt(x: number, count: number, width = AXIS_W): number {
  if (count <= 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round((x / width) * (count - 1))));
}

/** Degrees clockwise from north, for the compass points the bulletin uses. */
const BEARING: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function bearing(direction: string): number | null {
  return BEARING[direction] ?? null;
}

export interface Tally {
  name: string;
  days: number;
}

/** How often each name appears across the days that named any, most often first. */
function tally(lists: string[][]): { counts: Tally[]; reported: number } {
  const seen = new Map<string, number>();
  let reported = 0;
  for (const list of lists) {
    if (list.length === 0) continue;
    reported += 1;
    for (const name of new Set(list)) seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  const counts = [...seen].map(([name, days]) => ({ name, days }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, 'es'));
  return { counts, reported };
}

export interface FieldSummary {
  /** Directions tied for most common (several when tied), empty when none reported. */
  commonDrift: string[];
  /** Days stating the most common direction. */
  commonDriftDays: number;
  /** Days that stated any direction. */
  driftReported: number;
  /** Every direction stated, with the days it was stated, most often first. */
  drift: Tally[];
  /** Each named drainage and the days it was named. */
  drainages: Tally[];
  /** Days that named at least one drainage. */
  drainagesReported: number;
  /** Each ash-fall town and the days it was named. */
  towns: Tally[];
  townsReported: number;
  /** Days that stated an incandescence height. */
  incandescenceReported: number;
  total: number;
}

export function fieldSummary(series: IndexEntry[]): FieldSummary {
  const drift = tally(series.map((e) => e.driftDirections));
  const top = drift.counts[0]?.days ?? 0;
  const drainages = tally(series.map((e) => e.drainages));
  const towns = tally(series.map((e) => e.ashfallCommunities));
  return {
    commonDrift: drift.counts.filter((c) => c.days === top).map((c) => c.name),
    commonDriftDays: top,
    driftReported: drift.reported,
    drift: drift.counts,
    drainages: drainages.counts,
    drainagesReported: drainages.reported,
    towns: towns.counts,
    townsReported: towns.reported,
    incandescenceReported: series.filter((e) => e.incandescenceMaxM !== null).length,
    total: series.length,
  };
}

/** The tallest incandescence over the days that stated one; null when none did. */
export function incandescenceTop(series: IndexEntry[]): number | null {
  const v = series.flatMap((e) => (e.incandescenceMaxM === null ? [] : [e.incandescenceMaxM]));
  return v.length > 0 ? Math.max(...v) : null;
}
