import { guatemalaDate } from './date';

/** Past this many days the record is described as behind. */
export const BEHIND_AFTER_DAYS = 2;

export interface BulletinAge {
  /** Whole Guatemala calendar days between the bulletin and now. */
  days: number;
  /** "today", "1 day ago", "3 days ago". */
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
export function bulletinAge(date: string, now: Date = new Date()): BulletinAge | null {
  const days = dayNumber(guatemalaDate(now)) - dayNumber(date);
  if (!Number.isInteger(days) || days < 0) return null;
  return describeAge(days);
}

/** The wording for an age in whole days. */
export function describeAge(days: number): BulletinAge {
  const label = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  return { days, label, behind: days > BEHIND_AFTER_DAYS };
}
