/**
 * Types for a single day's volcanic bulletin from INSIVUMEH.
 *
 * Design note: `raw` is always preserved verbatim alongside `parsed`, and every
 * record carries the `parserVersion` that produced it. The parser is a pure
 * function of the raw text, so improving it later means re-running it over the
 * archive — no re-fetching, no data loss. Bulletins are only published for a
 * short window, so a field we fail to extract today would otherwise be gone
 * forever.
 */

export const PARSER_VERSION = 1;

/** Compass directions INSIVUMEH uses for ash dispersal, normalised to English. */
export type Direction =
  | 'N'
  | 'NE'
  | 'E'
  | 'SE'
  | 'S'
  | 'SW'
  | 'W'
  | 'NW';

export interface Range {
  min: number;
  max: number;
}

export interface ParsedBulletin {
  /** Strombolian explosions per hour, as reported by the seismic network. */
  explosionsPerHour: Range | null;
  /** Ash column height in metres above sea level (Fuego's summit is 3,763 m). */
  ashColumnMasl: Range | null;
  /** How far the plume drifted, in kilometres. */
  driftKm: number | null;
  /** Which way the plume drifted. */
  driftDirections: Direction[];
  /** Barrancas (drainages) named as taking avalanches, lava or lahars. */
  drainages: string[];
  /** Height of incandescent pulses above the crater, in metres. */
  incandescenceM: Range | null;
  /** Length of any active lava flow, in metres. */
  lavaFlowM: number | null;
  /** Observed phenomena, normalised to a controlled vocabulary. */
  phenomena: Phenomenon[];
}

export const PHENOMENA = [
  'explosions',
  'rumbling',
  'shockwaves',
  'avalanches',
  'ashfall',
  'degassing',
  'lahars',
  'lavaFlow',
  'incandescence',
] as const;

export type Phenomenon = (typeof PHENOMENA)[number];

export interface Bulletin {
  /** Local (Guatemala, UTC-6) date the bulletin describes: YYYY-MM-DD. */
  date: string;
  source: 'insivumeh';
  url: string;
  /** ISO timestamp of when we fetched it. */
  fetchedAt: string;
  /** Full bulletin text, verbatim. Never derived from, never discarded. */
  raw: string;
  parsed: ParsedBulletin;
  parserVersion: number;
  /** Fields the parser could not extract, for monitoring parser drift. */
  warnings: string[];
}
