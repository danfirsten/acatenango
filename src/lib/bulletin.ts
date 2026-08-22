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

export const PARSER_VERSION = 7;

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
  /**
   * Length of an active lava flow, in metres.
   *
   * Usually null, and correctly so: most bulletins that mention lava are either
   * forecasting the possibility of a flow or describing incandescent fragments
   * thrown above the crater. Neither is a flow, and neither may be recorded as
   * one.
   */
  lavaFlowM: number | null;
  /** Observed phenomena, normalised to a controlled vocabulary. */
  phenomena: Phenomenon[];
  /**
   * Sky over the observatory. The bulletin prints this as "Condiciones
   * atmosféricas", and it is the closest thing to an answer for the question
   * everyone hiking Acatenango actually asks: will the volcano be visible.
   */
  sky: Sky | null;
  /**
   * Communities the bulletin names as taking ashfall. Most days say only
   * "comunidades ubicadas en el flanco Oeste"; when the observer names places,
   * those names are the most human thing in the whole record.
   */
  ashfallCommunities: string[];
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
  'continuousPhase',
] as const;

export type Phenomenon = (typeof PHENOMENA)[number];

export const SKY = ['clear', 'partlyCloudy', 'cloudy'] as const;
export type Sky = (typeof SKY)[number];

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
