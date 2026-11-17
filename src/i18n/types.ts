/**
 * Every word the page shows, in one shape per language. Sentences built from
 * data are template functions, so each language can order and inflect them its
 * own way; no sentence is pieced together from English fragments.
 *
 * Text with a link in it uses `{name}` placeholders, filled by `rich()`.
 */

import type { ValueState } from '../lib/readout';

export type Locale = 'en' | 'es';

export type DriftRelation = 'towards' | 'away' | 'side';

/** Directions that sit the same way from camp, in the bulletin's order. */
export interface DriftGroup {
  relation: DriftRelation;
  /** Compass codes as the parser stores them: N, NE, SW... */
  directions: string[];
}

export type CompletenessField = 'rate' | 'column' | 'drift';

export interface Dict {
  locale: Locale;
  /** The value for <html lang>. */
  htmlLang: string;
  meta: {
    title: string;
    description: string;
    ogAlt: string;
    ogLocale: string;
  };
  /** Name of this language, in itself, for the switch on the other page. */
  languageName: string;
  /** Accessible label for a link to this language, in itself. */
  switchLabel: string;
  notice: {
    label: string;
    /** Bold lead. */
    lead: string;
    body: string;
    linksLabel: string;
    insivumeh: string;
    conred: string;
  };
  topbar: {
    representative: string;
    unread: (n: number) => string;
    latest: string;
    replaying: string;
    /** The age pill while an earlier day is shown: "Replaying 29 Jul". */
    replayingOn: (date: string) => string;
  };
  age: {
    label: (days: number) => string;
    behind: string;
  };
  /** Full compass words, by bulletin code. */
  compass: Record<string, string>;
  /** Compass abbreviations, by bulletin code. */
  compassAbbr: Record<string, string>;
  /** "a", "a and b", "a, b and c". */
  list: (items: string[]) => string;
  readout: {
    notReported: string;
    explosions: string;
    continuous: string;
    emission: string;
    perHour: string;
    ashColumn: string;
    mAsl: string;
    aboveSummit: string;
    metres: string;
    drift: string;
    heading: (dirs: string) => string;
    km: (dirs: string) => string;
    ashfallIn: string;
    drainages: string;
    ashfall: string;
    /** Ash fall described with no town named. */
    noneNamed: string;
    /** A left-out value the scene holds from an earlier day. */
    plumeShows: (date: string) => string;
  };
  /** The five marks' words, the same everywhere a value's state is shown. */
  marks: {
    label: string;
    word: Record<ValueState, string>;
    hint: Record<ValueState, string>;
  };
  replay: {
    label: string;
    previous: string;
    next: string;
    back: (date: string) => string;
  };
  notes: {
    bothHeld: (date: string) => string;
    rateHeld: (date: string) => string;
    rateNone: string;
    columnHeld: (date: string) => string;
    columnNone: string;
  };
  massif: {
    canvasLabel: string;
    erupting: string;
    yourCamp: string;
    viewsLabel: string;
    orbit: string;
    fromCamp: string;
    loading: string;
    unsupported: string;
    failed: string;
  };
  scrollcue: string;
  record: {
    title: string;
    intro: string;
    days: string;
    tallest: string;
    peakRate: string;
    notReported: string;
    perHour: (v: string) => string;
    daysOf: (n: number, total: number) => string;
  };
  tempo: {
    aria: (days: number, missing: number, continuous: number) => string;
    rate: (r: string) => string;
    continuous: string;
    rateMissing: string;
    ash: (m: string) => string;
    ashMissing: string;
    drift: (km: string) => string;
    driftMissing: string;
    /** Read out as the scrub moves: the day and its rate. */
    valueText: (date: string, rate: string) => string;
    keyDays: (n: number, total: number) => string;
  };
  lanes: {
    figureLabel: string;
    sliderLabel: string;
    driftTitle: string;
    glowTitle: string;
    drainagesTitle: string;
    townsTitle: string;
    daysOf: (n: number, total: number) => string;
    /** The dashed row on the drift lane: camp's bearing. */
    campRow: string;
    glowNote: (m: string | null) => string;
    notReported: string;
    dayDrift: (dirs: string | null) => string;
    dayGlow: (m: string | null) => string;
    dayDrainages: (names: string | null) => string;
    dayTowns: (names: string | null) => string;
    dayTownsNone: string;
    commonDrift: string;
    /** Most common drift: bulletin compass codes, worded per language. */
    commonDriftValue: (dirs: string[], days: number) => string;
    commonDriftNote: (n: number) => string;
    drainagesNamed: string;
    drainagesNote: (n: number) => string;
  };
  gvp: {
    sectionLabel: string;
    title: string;
    notStated: string;
    range: (min: string, max: string | null, unit: string) => string;
    perHour: string;
    mAsl: string;
    explosions: string;
    ashColumn: string;
    check: (what: string, gvp: string, bulletins: string) => string;
    noneYet: string;
    read: (weeks: number, differ: number) => string;
    keyMissing: string;
    keyDiffer: string;
    agree: string;
    differIntro: string;
    week: (from: string, to: string) => string;
    report: string;
    bulletins: string;
    bulletinLabel: (date: string) => string;
    /** Contains {gvp}: the programme's name, linked. */
    credit: string;
    programme: string;
  };
  camp: {
    title: string;
    representative: string;
    /** Contains {date}. */
    bulletinOf: string;
    empty: string;
    foot: (km: string, bearing: number, point: string) => string;
    /** Contains {notice}, {insivumeh} and {conred}. */
    advice: string;
    noticeLink: string;
    labels: { rate: string; column: string; drift: string; ashfall: string };
    rate: (figure: string, one: boolean) => string;
    rateLine: (rate: string) => string;
    continuous: string;
    continuousLine: string;
    rateMissing: string;
    columnRange: (min: string, top: string, above: string) => string;
    columnSingle: (top: string, above: string) => string;
    columnMissing: string;
    range: (min: string, max: string) => string;
    driftPhrase: (groups: DriftGroup[]) => string;
    driftFull: (km: string, where: string) => string;
    driftNoKm: (where: string) => string;
    driftNoDirection: (km: string) => string;
    driftMissing: string;
    ashfall: (places: string) => string;
    ashfallUnnamed: string;
    ashfallMissing: string;
    summaryAsh: (top: string, where: string | null) => string;
    summaryDrift: (where: string) => string;
    summaryNone: string;
  };
  colophon: {
    /** Contains {aws}. */
    terrain: (dem: string, published: string, exaggeration: string, relief: string, across: string) => string;
    representative: string;
    /** Contains {insivumeh}. */
    record: (count: number, first: string, last: string) => string;
    field: Record<CompletenessField, string>;
    completeness: (field: string, reported: number, total: number, continuous: number) => string;
    rawKept: string;
  };
}
