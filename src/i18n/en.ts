import type { DriftGroup, DriftRelation, Dict } from './types';

const NBSP = ' ';

/** "a", "a and b", "a, b and c". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

const COMPASS: Record<string, string> = {
  N: 'north', NE: 'north-east', E: 'east', SE: 'south-east',
  S: 'south', SW: 'south-west', W: 'west', NW: 'north-west',
};

const ABBR: Record<string, string> = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };

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

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const en: Dict = {
  locale: 'en',
  htmlLang: 'en',
  meta: {
    title: 'Fuego: live from the Acatenango massif',
    description: 'An unofficial archive of Volcán de Fuego, Guatemala, rendered from real elevation data.',
    ogAlt: 'Fuego erupting beside Acatenango',
    ogLocale: 'en_GB',
  },
  languageName: 'English',
  switchLabel: 'Read this page in English',
  notice: {
    label: 'About this record',
    lead: 'Unofficial archive.',
    body: 'Fuego is not a warning service. It copies INSIVUMEH’s daily bulletin once or twice a day, so it always lags the observatory.',
    linksLabel: 'Official sources',
    insivumeh: 'INSIVUMEH volcano page',
    conred: 'CONRED alerts',
  },
  topbar: {
    representative: 'Representative data',
    unread: (n) => `${n} ${plural(n, 'field', 'fields')} unread`,
    latest: 'Latest bulletin',
    replaying: 'Replaying',
    replayingOn: (d) => `Replaying ${d}`,
  },
  age: {
    label: (days) => (days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`),
    behind: 'the record is behind',
  },
  compass: COMPASS,
  compassAbbr: ABBR,
  list,
  readout: {
    notReported: 'Not reported',
    explosions: 'Explosions',
    continuous: 'continuous',
    emission: 'emission',
    perHour: 'per hour',
    ashColumn: 'Ash column',
    mAsl: 'm asl',
    aboveSummit: 'Above summit',
    metres: 'm',
    drift: 'Drift',
    heading: (dirs) => `heading ${dirs}`,
    km: (dirs) => `km ${dirs}`,
    ashfallIn: 'Ashfall named in',
    drainages: 'Drainages',
    ashfall: 'Ash fall',
    noneNamed: 'None named',
    plumeShows: (d) => `plume shows ${d}`,
  },
  marks: {
    label: 'How each value is marked',
    word: {
      reported: 'Reported',
      saidNone: 'Said none',
      notReported: 'Not reported',
      held: 'Held',
      continuous: 'Continuous',
    },
    hint: {
      reported: 'The figure as the bulletin wrote it.',
      saidNone: 'The bulletin speaks to it but names none.',
      notReported: 'Left out of the bulletin. Never drawn as 0.',
      held: 'The plume shows an earlier day, which is named.',
      continuous: 'Emission with no hourly count.',
    },
  },
  replay: {
    label: 'Replaying an earlier bulletin',
    previous: 'Previous day',
    next: 'Next day',
    back: (d) => `Back to ${d}`,
  },
  notes: {
    bothHeld: (d) => `No rate or ash column in this bulletin; the plume holds the rate and column of ${d}.`,
    rateHeld: (d) => `No explosion rate in this bulletin; the plume holds the rate of ${d}.`,
    rateNone: 'No explosion rate in this bulletin or any before it.',
    columnHeld: (d) => `No ash column in this bulletin; the plume holds the height of ${d}.`,
    columnNone: 'No ash column in this bulletin or any before it.',
  },
  massif: {
    canvasLabel: 'Three-dimensional view of the Acatenango and Fuego massif, built from elevation data',
    erupting: 'erupting',
    yourCamp: 'your camp',
    viewsLabel: 'Camera view',
    orbit: 'Orbit',
    fromCamp: 'From camp',
    loading: 'Loading elevation data…',
    unsupported: 'This view needs WebGL. The readings below work without it.',
    failed: 'Terrain unavailable. The readings below are unaffected.',
  },
  scrollcue: 'The record below drives the mountain',
  record: {
    title: 'Explosion tempo',
    intro:
      'Scrub the record and the mountain follows: the plume climbs to the ash column that day’s bulletin reported, and leans the way the observer wrote down. The chart and the volcano are the same number, drawn twice.',
    days: 'Days',
    tallest: 'Tallest column',
    peakRate: 'Peak rate',
    notReported: 'Not reported',
    perHour: (v) => `${v} /hr`,
    daysOf: (n, total) => `${n} of ${total} days`,
  },
  tempo: {
    aria: (days, missing, continuous) =>
      `Explosions per hour over ${days} days; ${missing} gave no rate and are left as gaps${continuous ? `, and ${continuous} were continuous emission with no hourly count` : ''}`,
    rate: (r) => `${r} explosions/hr`,
    continuous: 'Continuous emission, no hourly count',
    rateMissing: 'Explosion rate not reported',
    ash: (m) => `ash ${m} m`,
    ashMissing: 'ash not reported',
    drift: (km) => `drift ${km} km`,
    driftMissing: 'drift not reported',
    valueText: (date, rate) => `${date}: ${rate}`,
    keyDays: (n, total) => `${n} of ${total} days`,
  },
  lanes: {
    figureLabel: 'Daily fields from the bulletin, on the same days as the chart above',
    sliderLabel: 'Selected day',
    driftTitle: 'Ash drift toward',
    glowTitle: 'Incandescence height',
    drainagesTitle: 'Drainages named',
    townsTitle: 'Ash-fall towns named',
    daysOf: (n, total) => `${n} of ${total} days`,
    campRow: 'dashed: towards camp',
    glowNote: (m) => (m === null ? 'not reported' : `up to ${m} m above the crater`),
    notReported: 'not reported',
    dayDrift: (dirs) => `Drift ${dirs === null ? 'not reported' : `toward ${dirs}`}`,
    dayGlow: (m) => `Glow ${m === null ? 'not reported' : `${m} m`}`,
    dayDrainages: (names) => `Drainages ${names ?? 'not reported'}`,
    dayTowns: (names) => `Towns ${names ?? 'not reported'}`,
    dayTownsNone: 'Ash fall, no towns named',
    commonDrift: 'Most common drift',
    commonDriftValue: (dirs, days) => `${dirs.map((d) => ABBR[d] ?? d).join(', ')} (${days} ${plural(days, 'day', 'days')})`,
    commonDriftNote: (n) => `of ${n} days that stated one`,
    drainagesNamed: 'Drainages named',
    drainagesNote: (n) => `days named, of ${n} days that named any`,
  },
  gvp: {
    sectionLabel: 'Smithsonian weekly report cross-check',
    title: 'Smithsonian weekly report',
    notStated: 'not stated',
    range: (min, max, unit) => `${max === null ? min : `${min} to ${max}`} ${unit}`,
    perHour: 'per hour',
    mAsl: 'm above sea level',
    explosions: 'Explosions',
    ashColumn: 'Ash column',
    check: (what, gvp, bulletins) => `${what}: GVP ${gvp}; bulletins ${bulletins}`,
    noneYet: 'no weekly reports collected yet',
    folded: 'Smithsonian weekly reports: none collected yet.',
    read: (weeks, differ) => `${weeks} ${plural(weeks, 'week', 'weeks')} read · ${differ} differ`,
    keyMissing: 'No GVP report collected for the week',
    keyDiffer: 'The two sources differ',
    agree: 'No week has figures that clearly disagree with the bulletins.',
    differIntro:
      'In these weeks the report’s figures and the bulletins’ figures sit clearly apart. That can be a misread scan, a slip in the parser or a difference in what each source counts. Neither is taken as right, and nothing here has been corrected.',
    week: (from, to) => `${from} to ${to}`,
    report: 'GVP weekly report',
    bulletins: 'INSIVUMEH bulletins:',
    bulletinLabel: (d) => `INSIVUMEH bulletin, ${d}`,
    credit: 'Weekly figures from the {gvp}, Weekly Volcanic Activity Reports for Fuego.',
    programme: 'Smithsonian Institution Global Volcanism Program',
  },
  camp: {
    title: 'From camp',
    representative: 'Representative data',
    bulletinOf: 'Bulletin of {date}',
    empty:
      'No bulletin has been archived yet. When the first one is read, what it reported will be described here as it reads from Acatenango.',
    foot: (km, bearing, point) =>
      `Camp is taken at Acatenango’s summit, ${km} km from Fuego’s crater on a bearing of ${bearing}°, roughly ${point}. Ash drifting within a quarter of the compass of that bearing is described as towards Acatenango, the opposite quarter as away, and the rest as to one side.`,
    advice:
      'This describes what the bulletin reported. It is not advice on whether to climb or camp: read the {notice}, and see {insivumeh} and {conred} for alerts.',
    noticeLink: 'notice at the top',
    labels: { rate: 'Explosions', column: 'Ash column', drift: 'Drift relative to camp', ashfall: 'Ash fall' },
    rate: (figure, one) => `${figure} explosion${one ? '' : 's'} an hour`,
    rateLine: (rate) => `${rate}.`,
    continuous: 'continuous emission',
    continuousLine: 'Continuous emission, so the bulletin gives no hourly count.',
    rateMissing: 'The bulletin gave no explosion rate.',
    columnRange: (min, top, above) =>
      `Ash columns of ${min} to ${top}${NBSP}m above sea level, up to ${above}${NBSP}m above Fuego’s summit.`,
    columnSingle: (top, above) => `Ash to ${top}${NBSP}m above sea level, ${above}${NBSP}m above Fuego’s summit.`,
    columnMissing: 'The bulletin gave no ash column height.',
    range: (min, max) => `${min} to ${max}`,
    driftPhrase: (groups: DriftGroup[]) =>
      groups
        .map((g, i) => `${list(g.directions.map((d) => COMPASS[d]))}, ${(i === 0 ? RELATION_FIRST : RELATION_AGAIN)[g.relation]}`)
        .join(', and '),
    driftFull: (km, where) => `Ash drifting ${km}${NBSP}km ${where}.`,
    driftNoKm: (where) => `Ash drifting ${where}. The bulletin gave no drift distance.`,
    driftNoDirection: (km) =>
      `Ash drifting ${km}${NBSP}km. The bulletin gave no direction, so where it went relative to Acatenango is unknown.`,
    driftMissing: 'The bulletin gave no drift distance or direction.',
    ashfall: (places) => `Ash fall reported in ${places}.`,
    ashfallUnnamed: 'Ash fall reported; the bulletin named no towns.',
    ashfallMissing: 'The bulletin did not mention ash fall.',
    summaryAsh: (top, where) => `ash to ${top}${NBSP}m${where ? ` drifting ${where}` : ''}`,
    summaryDrift: (where) => `ash drifting ${where}`,
    summaryNone: 'The bulletin gave no explosion rate, ash column or drift.',
  },
  colophon: {
    terrain: (dem, published, exaggeration, relief, across) =>
      `Terrain from {aws}, SRTM-derived and public domain. Fuego resolves to ${dem} m against a published ${published} m. Vertical relief is exaggerated ×${exaggeration} so ${relief} km of it across ${across} km reads the way it does from the ridge.`,
    representative: 'The series shown is representative pending a fuller archive.',
    record: (count, first, last) =>
      `${count} bulletins from {insivumeh}, ${first} to ${last}, read out of scanned PDFs by OCR. Not every bulletin states every figure, and a figure it left out is shown as a gap, never as 0.`,
    field: { rate: 'explosion rate', column: 'ash column height', drift: 'drift distance' },
    completeness: (field, reported, total, continuous) =>
      `The ${field} was reported on ${reported} of ${total} days${continuous ? `, and ${continuous} more were continuous emission, which has no hourly count` : ''}.`,
    rawKept:
      'Every bulletin’s raw text is kept, so improving the parser re-derives the whole record without re-fetching anything.',
  },
};
