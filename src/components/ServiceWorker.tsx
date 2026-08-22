'use client';

import { useEffect } from 'react';

/**
 * Registers the offline cache.
 *
 * The point is not installability — it is that this site gets opened at
 * 3,976 m with no signal, so a first visit on wifi has to be enough to make the
 * whole thing available later.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registration is best-effort: it fails on file:// and in private windows,
    // and the site works perfectly well without it.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
