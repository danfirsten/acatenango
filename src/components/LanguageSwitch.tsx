'use client';

import { useEffect } from 'react';

import { getDict, LANG_KEY, LOCALE_PATH, type Locale } from '@/i18n';
import { withBase } from '@/lib/base-path';

/** sessionStorage key for the place to restore after switching language. */
const PLACE_KEY = 'fuego-place';

interface Place {
  id: string;
  offset: number;
}

function store(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Private mode or blocked storage: the switch still works, it just forgets.
  }
}

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/**
 * The section the viewer is reading: the last one whose top has scrolled past
 * the top of the screen, and how far into it they are. Both pages have the same
 * sections with the same ids, so the place carries across.
 */
function currentPlace(): Place | null {
  let place: Place | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('main :is(section, aside, figure, footer)[id]')) {
    const top = el.getBoundingClientRect().top;
    if (top <= 1) place = { id: el.id, offset: -top };
  }
  return place;
}

/**
 * A link to the same page in the other language. It keeps the viewer's place
 * (the section they were reading) and remembers the choice, so a later visit
 * to the English address opens the Spanish page for someone who chose it.
 * Without scripts it is a plain link.
 */
export default function LanguageSwitch({ locale }: { locale: Locale }) {
  const other: Locale = locale === 'en' ? 'es' : 'en';
  const target = getDict(other);
  const href = withBase(LOCALE_PATH[other]);

  useEffect(() => {
    const saved = read(() => localStorage, LANG_KEY);
    // Only an explicit earlier choice moves the reader; English stays the default.
    if (saved === 'es' && locale !== 'es') {
      window.location.replace(withBase(LOCALE_PATH.es) + window.location.hash);
      return;
    }
    const raw = read(() => sessionStorage, PLACE_KEY);
    if (!raw) return;
    store(() => sessionStorage, PLACE_KEY, null);
    try {
      const place = JSON.parse(raw) as Place;
      const el = document.getElementById(place.id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + place.offset, behavior: 'instant' });
    } catch {
      // A malformed place is ignored; the page opens at the top.
    }
  }, [locale]);

  function onClick() {
    store(() => localStorage, LANG_KEY, other);
    const place = currentPlace();
    store(() => sessionStorage, PLACE_KEY, place ? JSON.stringify(place) : null);
  }

  return (
    <a className="lang-switch" href={href} hrefLang={target.htmlLang} lang={target.htmlLang}
      aria-label={target.switchLabel} onClick={onClick}>
      {target.languageName}
    </a>
  );
}
