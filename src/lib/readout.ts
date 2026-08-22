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
}

/**
 * The most violent day in the record, by ash column height.
 *
 * Explosion rate is the wrong measure: during a paroxysm the bulletin stops
 * counting discrete explosions and describes continuous emission, so ranking by
 * rate skips the very days it is meant to find.
 */
export function paroxysmIndex(series: IndexEntry[]): number {
  return series.reduce(
    (best, e, i) => ((e.ashMaxMasl ?? 0) > (series[best].ashMaxMasl ?? 0) ? i : best),
    0,
  );
}

export function readoutRows(day: IndexEntry): ReadoutRow[] {
  const continuous = day.phenomena.includes('continuousPhase');
  const aboveSummit = day.ashMaxMasl === null ? null : day.ashMaxMasl - SUMMIT_M;

  const rows: ReadoutRow[] = [
    {
      key: 'Explosions',
      value: day.explosionsMax === null
        ? (continuous ? 'continuous' : '—')
        : `${day.explosionsMin}–${day.explosionsMax}`,
      unit: day.explosionsMax === null
        ? (continuous ? 'emission' : 'not reported')
        : 'per hour',
      lead: true,
    },
    { key: 'Ash column', value: day.ashMaxMasl?.toLocaleString() ?? '—', unit: 'm asl' },
    { key: 'Above summit', value: aboveSummit?.toLocaleString() ?? '—', unit: 'm' },
    {
      key: 'Drift',
      value: day.driftKm === null ? '—' : String(day.driftKm),
      unit: day.driftKm === null
        ? (day.driftDirections.join('·') || 'not reported')
        : `km ${day.driftDirections.join('·')}`,
    },
  ];

  // Named communities beat drainage counts when the observer gave us names.
  rows.push(
    day.ashfallCommunities.length > 0
      ? {
          key: 'Ashfall named in',
          value: String(day.ashfallCommunities.length),
          unit: day.ashfallCommunities.join(', '),
        }
      : {
          key: 'Drainages',
          value: String(day.drainages.length),
          unit: day.drainages.join(', ') || 'none named',
        },
  );

  return rows;
}

/** Evenly spaced label positions for a chart's x-axis, deduplicated. */
export function axisLabelIndices(count: number): number[] {
  if (count <= 0) return [];
  const last = count - 1;
  return [...new Set([0, Math.floor(last / 3), Math.floor((last * 2) / 3), last])];
}
