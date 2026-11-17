import type { IndexEntry } from '../../scripts/build-index';
import { SUMMIT_M } from './readout';
import { SUMMITS } from './terrain';
import { en } from '../i18n/en';
import { formatDate, formatNumber } from '../i18n/format';
import type { Dict, DriftGroup, DriftRelation, Locale } from '../i18n/types';

/**
 * The latest bulletin, described as it reads from camp on Acatenango.
 *
 * Every sentence is assembled from the parsed fields; nothing is guessed. A
 * field the bulletin left out is said to be missing, never read as 0. The words
 * describe what the bulletin reported and where the ash went relative to camp,
 * never whether anywhere is safe: that is INSIVUMEH's and CONRED's to say.
 */

interface Point {
  lat: number;
  lon: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Initial great-circle bearing from `from` to `to`, in degrees clockwise from north, 0 to 360. */
export function bearingDeg(from: Point, to: Point): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lon - from.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Great-circle distance in kilometres. */
export function distanceKm(from: Point, to: Point): number {
  const R = 6371;
  const dφ = toRad(to.lat - from.lat);
  const dλ = toRad(to.lon - from.lon);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Camp is taken at Acatenango's summit, the point the terrain is checked
 * against and the one the 3D scene's "From camp" view stands at.
 */
export const CAMP_BEARING_DEG = bearingDeg(SUMMITS.fuego, SUMMITS.acatenango);
export const CAMP_DISTANCE_KM = distanceKm(SUMMITS.fuego, SUMMITS.acatenango);

/** Bulletin compass points, as bearings. */
const COMPASS_DEG: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

/** Half of a quarter of the compass: a drift within this of camp's bearing is towards it. */
const TOLERANCE_DEG = 45;

export type { DriftRelation };

/**
 * How a drift direction sits relative to camp: towards it (within a quarter of
 * the compass centred on camp's bearing), away from it (the opposite quarter),
 * or to one side. Null for a direction the bulletin vocabulary doesn't have.
 */
export function driftRelation(direction: string, campBearing: number = CAMP_BEARING_DEG): DriftRelation | null {
  const deg = COMPASS_DEG[direction];
  if (deg === undefined) return null;
  const diff = Math.abs(((deg - campBearing + 540) % 360) - 180);
  // Rounded so a bearing that is a compass point on paper isn't moved by float noise.
  const d = Math.round(diff * 1e6) / 1e6;
  if (d <= TOLERANCE_DEG) return 'towards';
  if (d >= 180 - TOLERANCE_DEG) return 'away';
  return 'side';
}

/**
 * Directions grouped by how they sit from camp, in the order the bulletin gave
 * them; the dictionary words them ("north-east and north, towards Acatenango,
 * and east, to one side of it"). Null when no direction is known.
 */
function driftPhrase(directions: string[], t: Dict): string | null {
  const groups: DriftGroup[] = [];
  for (const d of directions) {
    const relation = driftRelation(d);
    if (relation === null) continue;
    const group = groups.find((g) => g.relation === relation);
    if (group) group.directions.push(d);
    else groups.push({ relation, directions: [d] });
  }
  return groups.length === 0 ? null : t.camp.driftPhrase(groups);
}

export type CampLineKey = 'rate' | 'column' | 'drift' | 'ashfall';

export interface CampLine {
  key: CampLineKey;
  /** Short label for the row. */
  label: string;
  text: string;
  /** Some or all of what this line covers was not in the bulletin. */
  missing: boolean;
  /** Towns named for ash fall, only on the ash-fall line. */
  places?: string[];
}

export interface CampDescription {
  entry: IndexEntry;
  /** One sentence from what was reported, leaving out what wasn't. */
  summary: string;
  lines: CampLine[];
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The camp panel's words for a bulletin, in the dictionary's language. Each
 * sentence is a template in the dictionary; this decides which one applies.
 */
export function describeCamp(entry: IndexEntry, t: Dict = en): CampDescription {
  const c = t.camp;
  const num = (n: number) => formatNumber(t.locale, n);
  const continuous = entry.explosionsMax === null && entry.phenomena.includes('continuousPhase');

  // Rate.
  let rate: string | null = null;
  let rateLine: CampLine;
  if (entry.explosionsMax !== null) {
    const { explosionsMin: min, explosionsMax: max } = entry;
    const single = min === null || min === max;
    rate = c.rate(single ? num(max) : c.range(num(min), num(max)), max === 1 && single);
    rateLine = { key: 'rate', label: c.labels.rate, text: c.rateLine(rate), missing: false };
  } else if (continuous) {
    rate = c.continuous;
    rateLine = { key: 'rate', label: c.labels.rate, text: c.continuousLine, missing: false };
  } else {
    rateLine = { key: 'rate', label: c.labels.rate, text: c.rateMissing, missing: true };
  }

  // Column.
  let columnLine: CampLine;
  const top = entry.ashMaxMasl;
  if (top !== null) {
    const above = num(top - SUMMIT_M);
    const min = entry.ashMinMasl;
    columnLine = {
      key: 'column',
      label: c.labels.column,
      text: min !== null && min !== top ? c.columnRange(num(min), num(top), above) : c.columnSingle(num(top), above),
      missing: false,
    };
  } else {
    columnLine = { key: 'column', label: c.labels.column, text: c.columnMissing, missing: true };
  }

  // Drift.
  const where = driftPhrase(entry.driftDirections, t);
  const km = entry.driftKm === null ? null : num(entry.driftKm);
  const driftLabel = c.labels.drift;
  const driftLine: CampLine =
    where !== null && km !== null ? { key: 'drift', label: driftLabel, text: c.driftFull(km, where), missing: false }
    : where !== null ? { key: 'drift', label: driftLabel, text: c.driftNoKm(where), missing: true }
    : km !== null ? { key: 'drift', label: driftLabel, text: c.driftNoDirection(km), missing: true }
    : { key: 'drift', label: driftLabel, text: c.driftMissing, missing: true };

  // Ash fall.
  const places = entry.ashfallCommunities;
  const ashfallLine: CampLine = places.length > 0
    ? { key: 'ashfall', label: c.labels.ashfall, text: c.ashfall(t.list(places)), missing: false, places }
    : entry.phenomena.includes('ashfall')
      ? { key: 'ashfall', label: c.labels.ashfall, text: c.ashfallUnnamed, missing: true }
      : { key: 'ashfall', label: c.labels.ashfall, text: c.ashfallMissing, missing: true };

  // Summary: only what was reported.
  let ash: string | null = null;
  if (top !== null) ash = c.summaryAsh(num(top), where);
  else if (where) ash = c.summaryDrift(where);
  const parts = [rate, ash].filter((p): p is string => p !== null);
  const summary = parts.length > 0 ? `${capitalise(parts.join(', '))}.` : c.summaryNone;

  return { entry, summary, lines: [rateLine, columnLine, driftLine, ashfallLine] };
}

/** The bulletin the panel describes: the latest, which the mountain also opens on. */
export function latestEntry(series: IndexEntry[]): IndexEntry | null {
  return series.at(-1) ?? null;
}

/** "16 Nov 2026" / "16 nov 2026", the same form the top bar uses. */
export function formatBulletinDate(iso: string, locale: Locale = 'en'): string {
  return formatDate(locale, iso);
}

/** "N" for 10°: the nearest of the bulletin's eight compass points. */
export function compassPoint(bearing: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

