/**
 * Days INSIVUMEH no longer serves. A gap is a fact worth recording: the chart
 * marks it "no bulletin" rather than drawing it as zero or hiding it.
 */

export interface Gap {
  /** Guatemala calendar date, YYYY-MM-DD. */
  date: string;
  /** Why there is no record, in plain words. */
  reason: string;
  /** ISO instant of the last attempt to collect it. */
  lastTried: string;
}

export interface GapsFile {
  gaps: Gap[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Every calendar date from `from` to `to`, inclusive, oldest first. */
export function dateRange(from: string, to: string): string[] {
  if (!DATE.test(from) || !DATE.test(to)) throw new Error(`bad date range ${from}..${to}`);
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Dates in the range that have no record, oldest first. */
export function missingDates(have: Iterable<string>, from: string, to: string): string[] {
  const held = new Set(have);
  return dateRange(from, to).filter((d) => !held.has(d));
}

/** Reads a gaps file leniently: anything malformed is dropped, never thrown. */
export function parseGaps(text: string | null): Gap[] {
  if (!text) return [];
  try {
    const raw = (JSON.parse(text) as Partial<GapsFile>).gaps;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (g): g is Gap =>
        !!g && typeof g.date === 'string' && DATE.test(g.date) &&
        typeof g.reason === 'string' && typeof g.lastTried === 'string',
    ).sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/**
 * Records new gaps, refreshing `lastTried` on ones already known, and drops any
 * gap whose date now has a record. Result is sorted and one entry per date.
 */
export function mergeGaps(existing: Gap[], found: Gap[], have: Iterable<string>): Gap[] {
  const held = new Set(have);
  const byDate = new Map<string, Gap>();
  for (const g of [...existing, ...found]) byDate.set(g.date, g);
  return [...byDate.values()]
    .filter((g) => !held.has(g.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function serializeGaps(gaps: Gap[]): string {
  return `${JSON.stringify({ gaps } satisfies GapsFile, null, 2)}\n`;
}

/**
 * Works out the range to backfill from command-line arguments:
 * `--from D --to D`, or a bare number of days back from `today`. With nothing
 * given it runs from the first held record to `today`.
 */
export function resolveRange(
  args: string[],
  today: string,
  firstHeld: string | null,
): { from: string; to: string } {
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const to = flag('--to') ?? today;
  const from = flag('--from');
  if (from) return { from, to };
  const days = Number(args.find((a) => /^\d+$/.test(a)));
  if (days > 0) return { from: shiftDays(to, -(days - 1)), to };
  return { from: firstHeld ?? to, to };
}

function shiftDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
