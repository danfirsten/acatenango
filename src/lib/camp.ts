import type { IndexEntry } from '../../scripts/build-index';
import { SUMMIT_M } from './readout';
import { SUMMITS } from './terrain';

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

const COMPASS_WORD: Record<string, string> = {
  N: 'north', NE: 'north-east', E: 'east', SE: 'south-east',
  S: 'south', SW: 'south-west', W: 'west', NW: 'north-west',
};

/** Half of a quarter of the compass: a drift within this of camp's bearing is towards it. */
const TOLERANCE_DEG = 45;

export type DriftRelation = 'towards' | 'away' | 'side';

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

/** "a", "a and b", "a, b and c". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

const metres = (n: number) => n.toLocaleString('en-GB');

/** Joins a figure to its unit so a line never breaks between them. */
const NBSP = '\u00a0';

const RELATION_FIRST: Record<DriftRelation, string> = {
  towards: 'towards Acatenango',
  away: 'away from Acatenango',
  side: 'to one side of Acatenango',
};
const RELATION_AGAIN: Record<DriftRelation, string> = {
  towards: 'towards it',
  away: 'away from it',
  side: 'to one side of it',
};

/**
 * "north-east and north, towards Acatenango, and east, to one side of it":
 * directions grouped by how they sit from camp, in the order the bulletin gave
 * them. Null when no direction is known.
 */
function driftPhrase(directions: string[]): string | null {
  const groups: { relation: DriftRelation; words: string[] }[] = [];
  for (const d of directions) {
    const relation = driftRelation(d);
    if (relation === null) continue;
    const group = groups.find((g) => g.relation === relation);
    if (group) group.words.push(COMPASS_WORD[d]);
    else groups.push({ relation, words: [COMPASS_WORD[d]] });
  }
  if (groups.length === 0) return null;
  return groups
    .map((g, i) => `${list(g.words)}, ${(i === 0 ? RELATION_FIRST : RELATION_AGAIN)[g.relation]}`)
    .join(', and ');
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

export function describeCamp(entry: IndexEntry): CampDescription {
  const continuous = entry.explosionsMax === null && entry.phenomena.includes('continuousPhase');

  // Rate.
  let rate: string | null = null;
  let rateLine: CampLine;
  if (entry.explosionsMax !== null) {
    const { explosionsMin: min, explosionsMax: max } = entry;
    const figure = min === null || min === max ? String(max) : `${min} to ${max}`;
    rate = `${figure} explosion${max === 1 && (min === null || min === max) ? '' : 's'} an hour`;
    rateLine = { key: 'rate', label: 'Explosions', text: `${rate}.`, missing: false };
  } else if (continuous) {
    rate = 'continuous emission';
    rateLine = { key: 'rate', label: 'Explosions', text: 'Continuous emission, so the bulletin gives no hourly count.', missing: false };
  } else {
    rateLine = { key: 'rate', label: 'Explosions', text: 'The bulletin gave no explosion rate.', missing: true };
  }

  // Column.
  let columnLine: CampLine;
  const top = entry.ashMaxMasl;
  if (top !== null) {
    const above = metres(top - SUMMIT_M);
    const min = entry.ashMinMasl;
    columnLine = {
      key: 'column',
      label: 'Ash column',
      text: min !== null && min !== top
        ? `Ash columns of ${metres(min)} to ${metres(top)}${NBSP}m above sea level, up to ${above}${NBSP}m above Fuego’s summit.`
        : `Ash to ${metres(top)}${NBSP}m above sea level, ${above}${NBSP}m above Fuego’s summit.`,
      missing: false,
    };
  } else {
    columnLine = { key: 'column', label: 'Ash column', text: 'The bulletin gave no ash column height.', missing: true };
  }

  // Drift.
  const where = driftPhrase(entry.driftDirections);
  const km = entry.driftKm;
  let driftLine: CampLine;
  if (where !== null && km !== null) {
    driftLine = { key: 'drift', label: 'Drift relative to camp', text: `Ash drifting ${km}${NBSP}km ${where}.`, missing: false };
  } else if (where !== null) {
    driftLine = {
      key: 'drift', label: 'Drift relative to camp',
      text: `Ash drifting ${where}. The bulletin gave no drift distance.`, missing: true,
    };
  } else if (km !== null) {
    driftLine = {
      key: 'drift', label: 'Drift relative to camp',
      text: `Ash drifting ${km}${NBSP}km. The bulletin gave no direction, so where it went relative to Acatenango is unknown.`,
      missing: true,
    };
  } else {
    driftLine = { key: 'drift', label: 'Drift relative to camp', text: 'The bulletin gave no drift distance or direction.', missing: true };
  }

  // Ash fall.
  const places = entry.ashfallCommunities;
  const ashfallLine: CampLine = places.length > 0
    ? { key: 'ashfall', label: 'Ash fall', text: `Ash fall reported in ${list(places)}.`, missing: false, places }
    : entry.phenomena.includes('ashfall')
      ? { key: 'ashfall', label: 'Ash fall', text: 'Ash fall reported; the bulletin named no towns.', missing: true }
      : { key: 'ashfall', label: 'Ash fall', text: 'The bulletin did not mention ash fall.', missing: true };

  // Summary: only what was reported.
  let ash: string | null = null;
  if (top !== null) ash = `ash to ${metres(top)}${NBSP}m${where ? ` drifting ${where}` : ''}`;
  else if (where) ash = `ash drifting ${where}`;
  const parts = [rate, ash].filter((p): p is string => p !== null);
  const summary = parts.length > 0
    ? `${capitalise(parts.join(', '))}.`
    : 'The bulletin gave no explosion rate, ash column or drift.';

  return { entry, summary, lines: [rateLine, columnLine, driftLine, ashfallLine] };
}

/** The bulletin the panel describes: the latest, which the mountain also opens on. */
export function latestEntry(series: IndexEntry[]): IndexEntry | null {
  return series.at(-1) ?? null;
}

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

/** "16 Nov 2026", the same form the top bar uses. */
export function formatBulletinDate(iso: string): string {
  return DATE.format(new Date(`${iso}T00:00:00Z`));
}

/** "N" for 10°: the nearest of the bulletin's eight compass points. */
export function compassPoint(bearing: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export { COMPASS_WORD };
