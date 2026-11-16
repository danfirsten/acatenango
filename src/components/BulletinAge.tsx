'use client';

import { useSyncExternalStore } from 'react';

import { bulletinAge, describeAge } from '@/lib/bulletin-age';

const subscribe = () => () => {};

/**
 * How old the latest bulletin is. The age is read from the viewer's clock in the
 * browser, so the static export never goes stale. The server snapshot is null:
 * the built HTML (and a page with scripts off) shows only the date.
 */
export default function BulletinAge({ date }: { date: string }) {
  const days = useSyncExternalStore(
    subscribe,
    () => bulletinAge(date)?.days ?? null,
    () => null,
  );

  if (days === null) return null;
  const age = describeAge(days);
  return (
    <span className="bulletin-age" data-behind={age.behind}>
      , {age.label}
      {age.behind && <> · the record is behind</>}
    </span>
  );
}
