'use client';

import { useSyncExternalStore } from 'react';

import { getDict, type Locale } from '@/i18n';
import { bulletinAge, describeAge } from '@/lib/bulletin-age';

const subscribe = () => () => {};

/**
 * How old the latest bulletin is. The age is read from the viewer's clock in the
 * browser, so the static export never goes stale. The server snapshot is null:
 * the built HTML (and a page with scripts off) shows only the date.
 */
export default function BulletinAge({ date, locale }: { date: string; locale: Locale }) {
  const days = useSyncExternalStore(
    subscribe,
    () => bulletinAge(date)?.days ?? null,
    () => null,
  );

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
