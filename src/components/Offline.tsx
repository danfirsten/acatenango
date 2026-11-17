'use client';

import { useEffect, useState } from 'react';

import Hoop from '@/components/ink/Hoop';
import { formatShortDate, getDict, type Locale } from '@/i18n';

/**
 * "Offline · saved copy · <newest bulletin date>", with Hoop asleep (eyes as
 * closed lines). Shown while there is no network, so a saved copy is never
 * mistaken for a fresh one. Still: Hoop does not move.
 */
export default function Offline({ locale, newest }: { locale: Locale; newest: string | null }) {
  const t = getDict(locale).offline;
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    const id = requestAnimationFrame(sync);
    window.addEventListener('offline', sync);
    window.addEventListener('online', sync);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('offline', sync);
      window.removeEventListener('online', sync);
    };
  }, []);

  if (!offline || newest === null) return null;
  return (
    <span className="offline-chip num" role="status" data-offline="true">
      <Hoop state="asleep" size={18} />
      {t.chip(formatShortDate(locale, newest))}
    </span>
  );
}
