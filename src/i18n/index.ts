import { en } from './en';
import { es } from './es';
import type { Dict, Locale } from './types';

export type { Dict, Locale } from './types';
export { formatDate, formatNumber, formatShortDate, INTL } from './format';

export const LOCALES: Locale[] = ['en', 'es'];

export const DICTS: Record<Locale, Dict> = { en, es };

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

/** Each language's page, relative to the site root (before the base path). */
export const LOCALE_PATH: Record<Locale, string> = { en: '/', es: '/es/' };

/** localStorage key for the reader's chosen language. */
export const LANG_KEY = 'fuego-lang';
