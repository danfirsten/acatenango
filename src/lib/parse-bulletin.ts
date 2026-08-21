import {
  PARSER_VERSION,
  type Direction,
  type ParsedBulletin,
  type Phenomenon,
  type Range,
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

const EXPLOSION_UNIT = String.raw`explosion(?:es)?\s*(?:d[ée]biles?|moderadas?|fuertes?|\s|,|y)*\s*por\s+hora`;
const MASL_UNIT = String.raw`(?:msnm|m\.?\s?s\.?\s?n\.?\s?m\.?|metros\s+sobre\s+el\s+nivel\s+del\s+mar)`;

export function parseExplosionsPerHour(text: string): Range | null {
  return matchRange(text, EXPLOSION_UNIT);
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
  const m = new RegExp(String.raw`(${NUM})\s*(?:km|kil[óo]metros?)`, 'i').exec(
    scope,
  );
  return m ? parseSpanishNumber(m[1]) : null;
}

/** The named barrancas on Fuego's flanks that bulletins report activity in. */
const DRAINAGES = [
  'Seca',
  'Ceniza',
  'Trinidad',
  'Taniluyá',
  'Las Lajas',
  'Honda',
  'El Jute',
  'Santa Teresa',
  'Mineral',
];

export function parseDrainages(text: string): string[] {
  // "Ceniza" is both a barranca and the ordinary word for ash, so match only
  // inside the clause that actually names drainages.
  const clauses = [
    ...text.matchAll(/barrancas?[\s\S]{0,200}/gi),
  ].map((m) => m[0]);
  if (clauses.length === 0) return [];
  const scope = clauses.join(' ');

  const found: string[] = [];
  for (const name of DRAINAGES) {
    // Accent-insensitive: bulletins are inconsistent about "Taniluyá"/"Taniluya".
    const pattern = name
      .replace(/á/gi, '[aá]')
      .replace(/é/gi, '[eé]')
      .replace(/í/gi, '[ií]')
      .replace(/ó/gi, '[oó]')
      .replace(/ú/gi, '[uú]');
    if (new RegExp(String.raw`\b${pattern}\b`, 'i').test(scope)) {
      found.push(name);
    }
  }
  return found;
}

export function parseIncandescence(text: string): Range | null {
  const clause = /incandescen\w*[\s\S]{0,120}/i.exec(text);
  if (!clause) return null;
  return matchRange(clause[0], String.raw`(?:m\b|metros)`);
}

export function parseLavaFlow(text: string): number | null {
  const m =
    /flujos?\s+de\s+lava[\s\S]{0,120}?(\d[\d.,]*)\s*(?:m\b|metros)/i.exec(text);
  return m ? parseSpanishNumber(m[1]) : null;
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
];

export function parsePhenomena(text: string): Phenomenon[] {
  return PHENOMENON_TERMS.filter(([re]) => re.test(text)).map(([, p]) => p);
}

export interface ParseResult {
  parsed: ParsedBulletin;
  warnings: string[];
  parserVersion: number;
}

export function parseBulletin(raw: string): ParseResult {
  // Collapse whitespace so PDF-extracted line breaks don't split phrases.
  const text = raw.replace(/\s+/g, ' ');

  const parsed: ParsedBulletin = {
    explosionsPerHour: parseExplosionsPerHour(text),
    ashColumnMasl: parseAshColumn(text),
    driftKm: parseDriftKm(text),
    driftDirections: parseDriftDirections(text),
    drainages: parseDrainages(text),
    incandescenceM: parseIncandescence(text),
    lavaFlowM: parseLavaFlow(text),
    phenomena: parsePhenomena(text),
  };

  const warnings: string[] = [];
  if (!text.trim()) warnings.push('empty-bulletin-text');
  if (parsed.explosionsPerHour === null) warnings.push('no-explosion-rate');
  if (parsed.ashColumnMasl === null) warnings.push('no-ash-column');
  if (parsed.driftDirections.length === 0) warnings.push('no-drift-direction');
  // Fuego's summit is 3,763 m; a plume below that is a misparse, not a reading.
  if (parsed.ashColumnMasl && parsed.ashColumnMasl.min < 3763) {
    warnings.push('ash-column-below-summit');
  }

  return { parsed, warnings, parserVersion: PARSER_VERSION };
}
