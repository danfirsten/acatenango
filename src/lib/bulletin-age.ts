import { guatemalaDate } from './date';
import { en } from '../i18n/en';
import type { Dict } from '../i18n/types';

/** Past this many days the record is described as behind. */
export const BEHIND_AFTER_DAYS = 2;

export interface BulletinAge {
  /** Whole Guatemala calendar days between the bulletin and now. */
  days: number;
  /** "today", "1 day ago", "3 days ago"; "hoy", "hace 3 días". */
  label: string;
  /** True once the latest bulletin is older than BEHIND_AFTER_DAYS. */
  behind: boolean;
}

function dayNumber(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
}

/**
 * How old a bulletin is, by Guatemala calendar day. Returns null when the date
 * is unreadable or in the future (a skewed clock): showing nothing beats a
 * wrong age.
 */
export function bulletinAge(date: string, now: Date = new Date(), t: Dict = en): BulletinAge | null {
  const days = dayNumber(guatemalaDate(now)) - dayNumber(date);
  if (!Number.isInteger(days) || days < 0) return null;
  return describeAge(days, t);
}

/** The wording for an age in whole days, in the dictionary's language. */
export function describeAge(days: number, t: Dict = en): BulletinAge {
  return { days, label: t.age.label(days), behind: days > BEHIND_AFTER_DAYS };
}
