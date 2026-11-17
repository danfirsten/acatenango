import type { Locale } from './types';

/**
 * Dates and numbers per language. English is British (en-GB, as the site has
 * always been); Spanish is Guatemalan (es-GT), which groups thousands with a
 * comma and uses a point for decimals, as INSIVUMEH's bulletins do.
 */
export const INTL: Record<Locale, string> = { en: 'en-GB', es: 'es-GT' };

const cache = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: Locale, withYear: boolean): Intl.DateTimeFormat {
  const key = `${locale}:${withYear}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(INTL[locale], {
      day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }), timeZone: 'UTC',
    });
    cache.set(key, f);
  }
  return f;
}

/** "16 Nov 2026" / "16 nov 2026" for a YYYY-MM-DD bulletin date. */
export function formatDate(locale: Locale, iso: string): string {
  return dateFormat(locale, true).format(new Date(`${iso}T00:00:00Z`));
}

/** "16 Nov" / "16 nov", for chart axes and tips. */
export function formatShortDate(locale: Locale, iso: string): string {
  return dateFormat(locale, false).format(new Date(`${iso}T00:00:00Z`));
}

/** "4,500", "1.5"; with `digits`, exactly that many decimals ("6.0"). */
export function formatNumber(locale: Locale, n: number, digits?: number): string {
  return n.toLocaleString(INTL[locale], digits === undefined ? undefined : {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
}
