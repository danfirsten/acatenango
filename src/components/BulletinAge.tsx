'use client';

import { useSyncExternalStore } from 'react';

import { formatShortDate, getDict, type Locale } from '@/i18n';
import { bulletinAge, describeAge } from '@/lib/bulletin-age';

const subscribe = () => () => {};

/**
 * Whole days since the bulletin, read from the viewer's clock in the browser so
 * the static export never goes stale. The server snapshot is null: the built
 * HTML (and a page with scripts off) shows only the date.
 */
function useAgeDays(date: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => bulletinAge(date)?.days ?? null,
    () => null,
  );
}

/**
 * How old the latest bulletin is, after its date in running text
 * (", yesterday"), as the camp panel uses it.
 */
export default function BulletinAge({ date, locale }: { date: string; locale: Locale }) {
  const days = useAgeDays(date);
  if (days === null) return null;
  const t = getDict(locale);
  const age = describeAge(days, t);
  return (
    <span className="bulletin-age" data-behind={age.behind}>
      , {age.label}
      {age.behind && <span className="bulletin-behind"> · {t.age.behind}</span>}
    </span>
  );
}

/**
 * The age pill in the top row: "16 Nov · today", "yesterday", "3 days old".
 * Past two days its edge turns dashed and a line under the row says the record
 * is behind. It says how old the copy is, never whether anything is safe.
 */
export function AgePill({ date, locale }: { date: string; locale: Locale }) {
  const days = useAgeDays(date);
  const t = getDict(locale);
  const age = days === null ? null : describeAge(days, t);
  return (
    <>
      <span className="observed-date age-pill num" data-behind={age?.behind || undefined}>
        <time dateTime={date}>{formatShortDate(locale, date)}</time>
        {age && ` · ${age.label}`}
      </span>
      {age?.behind && <p className="age-behind">{t.age.behindNote}</p>}
    </>
  );
}
