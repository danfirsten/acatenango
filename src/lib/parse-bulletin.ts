import { activitySection, cleanOcrText } from './ocr';
import {
  PARSER_VERSION,
  type Direction,
  type ParsedBulletin,
  type Phenomenon,
  type Range,
  type Sky,
} from './bulletin';

/**
 * Parses the Spanish-language text of an INSIVUMEH volcanic bulletin.
 *
 * The bulletins are written by humans and the phrasing drifts, so every
 * extractor is independent and failure-tolerant: a field that cannot be found
 * yields `null` and a warning rather than throwing. Partial data is useful;
 * a crashed collector is not.
 */

/**
 * Spanish bulletins mix thousands separators ("4,500" and "4.500" both mean
 * 4500) with decimals ("1.1 km"). Disambiguate by shape rather than locale.
 */
export function parseSpanishNumber(input: string): number | null {
  const s = input.trim();
  // Grouped thousands: 4,500 / 4.500 / 1,234,567
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    return Number(s.replace(/[.,]/g, ''));
  }
  // Decimal: 1.1 / 1,1
  if (/^\d+[.,]\d+$/.test(s)) {
    return Number(s.replace(',', '.'));
  }
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

const NUM = String.raw`\d[\d.,]*`;
/** "a", "y", "-", "–" all appear as range separators. */
const RANGE_SEP = String.raw`(?:a|y|hasta|-|–|—)`;

function matchRange(
  text: string,
  unitPattern: string,
): Range | null {
  const rangeRe = new RegExp(
    String.raw`(?:de\s+|entre\s+)?(${NUM})\s*${RANGE_SEP}\s*(${NUM})\s*${unitPattern}`,
    'i',
  );
  const m = rangeRe.exec(text);
  if (m) {
    const min = parseSpanishNumber(m[1]);
    const max = parseSpanishNumber(m[2]);
    if (min !== null && max !== null) {
      return { min: Math.min(min, max), max: Math.max(min, max) };
    }
  }
  const singleRe = new RegExp(String.raw`(${NUM})\s*${unitPattern}`, 'i');
  const s = singleRe.exec(text);
  if (s) {
    const v = parseSpanishNumber(s[1]);
    if (v !== null) return { min: v, max: v };
  }
  return null;
}

/**
 * The rate is printed at least two ways:
 *   "entre 6 y 9 explosiones por hora"          — numbers before the noun
 *   "explosiones débiles... a un ritmo de 2 a 6 por hora"  — numbers after it
 * so match "por hora" in a window around the mention rather than assuming the
 * numbers sit adjacent to the word.
 */
/**
 * Observers routinely stack qualifiers between the noun and the rate — "de 6 a 8
 * explosiones de características débiles y moderadas por hora" — so allow a
 * short run of words in between. "km" is excluded so a wind speed in km/h can
 * never be read as an explosion rate.
 */
const PER_HOUR_UNIT = String.raw`(?:explosion(?:es)?\s+)?(?:(?!km\b)[a-záéíóúñ]+\s+){0,6}?por\s+hora`;
/** Metres above sea level, in the several spellings the bulletins use. */
const MASL_UNIT = String.raw`(?:msnm|m\.?\s?s\.?\s?n\.?\s?m\.?|metros\s+sobre\s+el\s+nivel\s+del\s+mar)`;

export function parseExplosionsPerHour(text: string): Range | null {
  const mention = /explosion\w*/i.exec(text);
  if (!mention) return null;
  const start = Math.max(0, mention.index - 120);
  const window = text.slice(start, mention.index + 220);
  return matchRange(window, PER_HOUR_UNIT);
}

export function parseAshColumn(text: string): Range | null {
  // Anchor near the ash-column phrasing so we don't pick up an unrelated
  // altitude (e.g. the observatory's own elevation) elsewhere in the bulletin.
  const context =
    /(?:columnas?\s+de\s+(?:ceniza|gas(?:es)?(?:\s+y\s+ceniza)?)|ceniza)[\s\S]{0,160}/i.exec(
      text,
    );
  return matchRange(context ? context[0] : text, MASL_UNIT);
}

/**
 * Direction matching is split in two because Spanish prose collides badly with
 * compass abbreviations: "se" is a pronoun, "no" is a negation, "o" means "or",
 * and "e" means "and". Spelled-out names are matched case-insensitively; the
 * abbreviations are matched only in uppercase, and only inside the dispersal
 * clause.
 */
const DIRECTION_WORDS: Array<[RegExp, Direction]> = [
  [/\bnor(?:[-\s])?este\b|\bnordeste\b/i, 'NE'],
  [/\bnor(?:[-\s])?oeste\b/i, 'NW'],
  [/\bsur(?:[-\s])?este\b|\bsud(?:[-\s])?este\b/i, 'SE'],
  [/\bsur(?:[-\s])?oeste\b|\bsud(?:[-\s])?oeste\b/i, 'SW'],
  [/\bnorte\b/i, 'N'],
  [/\bsur\b/i, 'S'],
  [/\beste\b/i, 'E'],
  [/\boeste\b/i, 'W'],
];

const DIRECTION_ABBREVS: Array<[RegExp, Direction]> = [
  [/\bNE\b/, 'NE'],
  [/\bN[OW]\b/, 'NW'],
  [/\bSE\b/, 'SE'],
  [/\bS[OW]\b/, 'SW'],
  [/\bN\b/, 'N'],
  [/\bS\b/, 'S'],
  [/\bE\b/, 'E'],
  [/\b[OW]\b/, 'W'],
];

/** The clause naming where the plume went; directions appear elsewhere too. */
const DISPERSAL_CLAUSE =
  /(?:se\s+)?(?:dispers\w+|desplaz\w+|dirig\w+|traslad\w+|extiend\w+)[\s\S]{0,160}/i;

export function parseDriftDirections(text: string): Direction[] {
  const clause = DISPERSAL_CLAUSE.exec(text);
  if (!clause) return [];
  const scope = clause[0];

  const found = new Set<Direction>();
  for (const [re, dir] of DIRECTION_WORDS) {
    if (re.test(scope)) found.add(dir);
  }
  for (const [re, dir] of DIRECTION_ABBREVS) {
    if (re.test(scope)) found.add(dir);
  }
  return [...found];
}

export function parseDriftKm(text: string): number | null {
  const clause = DISPERSAL_CLAUSE.exec(text);
  const scope = clause ? clause[0] : text;
  // Distance is often a range ("de 10 a 20 km"); the reach is the useful figure.
  const range = matchRange(scope, String.raw`(?:km|kil[óo]metros?)`);
  return range ? range.max : null;
}

/**
 * The named barrancas on Fuego's flanks. Bulletins shorten and mis-accent these
 * freely — "Las Lajas" is usually printed as just "Lajas" — so each canonical
 * name carries the spellings actually seen in print.
 */
const DRAINAGES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Seca', pattern: /\bseca\b/i },
  { name: 'Ceniza', pattern: /\bceniza\b/i },
  { name: 'Trinidad', pattern: /\btrinidad\b/i },
  { name: 'Taniluyá', pattern: /\btanilu[yi][aá]\b/i },
  { name: 'Las Lajas', pattern: /\b(?:las\s+)?lajas\b/i },
  { name: 'Honda', pattern: /\bhonda\b/i },
  { name: 'El Jute', pattern: /\b(?:el\s+)?jute\b/i },
  { name: 'Santa Teresa', pattern: /\bsanta\s+teresa\b/i },
  { name: 'Mineral', pattern: /\bmineral\b/i },
];

export function parseDrainages(text: string): string[] {
  // "Ceniza" is both a barranca and the ordinary word for ash, so match only
  // inside the clause that actually names drainages.
  const clauses = [...text.matchAll(/barrancas?[\s\S]{0,200}/gi)].map((m) => m[0]);
  if (clauses.length === 0) return [];
  const scope = clauses.join(' ');
  return DRAINAGES.filter((d) => d.pattern.test(scope)).map((d) => d.name);
}

const SKY_TERMS: Array<[RegExp, Sky]> = [
  // Order matters: "parcialmente nublado" must not be read as "nublado".
  [/parcialmente\s+nublad|semi\s*nublad/i, 'partlyCloudy'],
  [/despejad/i, 'clear'],
  [/nublad|cubierto/i, 'cloudy'],
];

export function parseSky(text: string): Sky | null {
  // Anchored to the bulletin's own label so an offhand mention of cloud in the
  // activity prose does not become the day's sky reading.
  const clause = /condiciones\s+atmosf[eé]ricas?\s*:?([\s\S]{0,60})/i.exec(text);
  const scope = clause ? clause[1] : '';
  for (const [re, sky] of SKY_TERMS) if (re.test(scope)) return sky;
  return null;
}

export function parseIncandescence(text: string): Range | null {
  const clause = /incandescen\w*[\s\S]{0,120}/i.exec(text);
  if (!clause) return null;
  return matchRange(clause[0], String.raw`(?:m\b|metros)`);
}

export function parseLavaFlow(text: string): number | null {
  // Only an observed flow with a stated length counts. Two look-alikes must
  // never be recorded as flows: a forecast ("posibilidad de generar flujos de
  // lava en los próximos días") and incandescent fragments thrown above the
  // crater ("fragmentos de lava a 200 mts de altura"), which is a height.
  const m =
    /flujos?\s+de\s+lava(?![\s\S]{0,40}pr[óo]xim)[\s\S]{0,90}?(\d[\d.,]*)\s*(?:m\b|mts?\b|metros)\s*(?:de\s+)?(?:longitud|largo)/i
      .exec(text);
  return m ? parseSpanishNumber(m[1]) : null;
}

/**
 * Communities around Fuego that bulletins name when ash falls on them. A fixed
 * list, because the parser must never invent a place name — matching real
 * printed names is reporting; guessing at capitalised words is not.
 */
const COMMUNITIES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Panimaché I', pattern: /\bpanimach[eé]\s*(?:i\b|1\b)(?!\s*i)/i },
  { name: 'Panimaché II', pattern: /\bpanimach[eé]\s*(?:ii\b|2\b)/i },
  { name: 'Morelia', pattern: /\bmorelia\b/i },
  { name: 'Santa Sofía', pattern: /\bsanta\s+sof[ií]a\b/i },
  { name: 'El Porvenir', pattern: /\bel\s+porvenir\b/i },
  { name: 'Sangre de Cristo', pattern: /\bsangre\s+de\s+cristo\b/i },
  { name: 'San Pedro Yepocapa', pattern: /\b(?:san\s+pedro\s+)?yepocapa\b/i },
  { name: 'Pochuta', pattern: /\bpochuta\b/i },
  { name: 'Alotenango', pattern: /\balotenango\b/i },
  { name: 'La Rochela', pattern: /\bla\s+rochela\b/i },
  { name: 'Ceilán', pattern: /\bceil[aá]n\b/i },
  { name: 'El Rodeo', pattern: /\bel\s+rodeo\b/i },
  { name: 'Los Yucales', pattern: /\blos\s+yucales\b/i },
  { name: 'Sacatepéquez', pattern: /\bsacatep[eé]quez\b/i },
];

export function parseAshfallCommunities(text: string): string[] {
  // Scope to the ashfall clause: these names also appear in evacuation advice
  // and in lahar warnings, which are different statements about the same places.
  const clauses = [...text.matchAll(/ca[íi]da\s+de\s+ceniza[\s\S]{0,240}/gi)].map((m) => m[0]);
  if (clauses.length === 0) return [];
  const scope = clauses.join(' ');
  return COMMUNITIES.filter((c) => c.pattern.test(scope)).map((c) => c.name);
}

const PHENOMENON_TERMS: Array<[RegExp, Phenomenon]> = [
  [/explosion(?:es)?/i, 'explosions'],
  [/retumbos?/i, 'rumbling'],
  [/ondas?\s+de\s+choque/i, 'shockwaves'],
  [/avalanchas?/i, 'avalanches'],
  [/ca[íi]da\s+de\s+ceniza|ceniza\s+en\s+suspensi[óo]n/i, 'ashfall'],
  [/desgasificaci[óo]n/i, 'degassing'],
  [/lahares?/i, 'lahars'],
  [/flujos?\s+de\s+lava/i, 'lavaFlow'],
  [/incandescen\w+/i, 'incandescence'],
  // During a paroxysm the bulletin stops counting explosions and describes a
  // continuous emission instead. The missing rate is the signal, not a failure.
  [/fase\s+eruptiva|emisi[óo]n\s+(?:constante|continua)|corrientes\s+de\s+densidad\s+pirocl[áa]stica/i,
    'continuousPhase'],
];

export function parsePhenomena(text: string): Phenomenon[] {
  return PHENOMENON_TERMS.filter(([re]) => re.test(text)).map(([, p]) => p);
}

export interface ParseResult {
  parsed: ParsedBulletin;
  warnings: string[];
  parserVersion: number;
}

/**
 * Parses the verbatim text of a Fuego bulletin page.
 *
 * Takes the raw text exactly as captured — OCR damage included — and does its
 * own cleaning and sectioning, so it stays a pure function of what was stored.
 * That is what lets a future parser re-derive the whole archive without
 * re-fetching a single bulletin.
 */
export function parseBulletin(raw: string): ParseResult {
  // Collapse whitespace so line breaks from OCR or PDF text do not split phrases.
  const full = cleanOcrText(raw).replace(/\s+/g, ' ');
  // Activity figures come from the activity paragraph only: the page sidebar
  // carries the summit elevation, which reads exactly like an ash column.
  const text = activitySection(full);

  const parsed: ParsedBulletin = {
    explosionsPerHour: parseExplosionsPerHour(text),
    ashColumnMasl: parseAshColumn(text),
    driftKm: parseDriftKm(text),
    driftDirections: parseDriftDirections(text),
    drainages: parseDrainages(text),
    incandescenceM: parseIncandescence(text),
    lavaFlowM: parseLavaFlow(text),
    phenomena: parsePhenomena(text),
    // Printed in the sidebar, outside the activity paragraph.
    sky: parseSky(full),
    ashfallCommunities: parseAshfallCommunities(text),
  };

  const warnings: string[] = [];
  if (!full.trim()) warnings.push('empty-bulletin-text');
  // Warn only when the bulletin printed a rate that the parser then failed to
  // read. Plenty of bulletins publish no per-hour figure at all — during a
  // paroxysm there is nothing discrete to count, and on quieter days the
  // observer sometimes just describes the explosions without counting them.
  // Treating those as parser failures would make the error rate meaningless.
  if (parsed.explosionsPerHour === null && /por\s+hora/i.test(text)) {
    warnings.push('no-explosion-rate');
  }
  // Same rule for the other fields: only a printed-but-unread value is a failure.
  if (parsed.ashColumnMasl === null && /msnm|nivel del mar/i.test(text)) {
    warnings.push('no-ash-column');
  }
  if (parsed.driftDirections.length === 0 && DISPERSAL_CLAUSE.test(text)) {
    warnings.push('no-drift-direction');
  }
  // Fuego's summit is 3,763 m; a plume below that is a misparse, not a reading.
  if (parsed.ashColumnMasl && parsed.ashColumnMasl.min < 3763) {
    warnings.push('ash-column-below-summit');
  }

  return { parsed, warnings, parserVersion: PARSER_VERSION };
}
