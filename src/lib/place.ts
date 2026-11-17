import type { Locale } from '../i18n/types';

/**
 * Where a reader is on the page, carried across a language switch, and which
 * language they chose. Browser only. Every storage call is wrapped: in a
 * private window storage can throw, and then the switch is a plain link.
 */

/** localStorage: the language the reader last chose. */
export const LANG_KEY = 'fuego-lang';
/** sessionStorage: the place to restore on the other language's page. */
export const PLACE_KEY = 'fuego-place';

export interface Place {
  /** The section at the top of the screen, and how far into it. */
  id: string | null;
  offset: number;
  /** The day being replayed (YYYY-MM-DD), so the mountain and chart stay on it. */
  day: string | null;
}

function get(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function set(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Blocked storage: the reader keeps the link, not the memory.
  }
}

export function rememberedLanguage(): Locale | null {
  const v = get(() => localStorage, LANG_KEY);
  return v === 'en' || v === 'es' ? v : null;
}

export function rememberLanguage(locale: Locale): void {
  set(() => localStorage, LANG_KEY, locale);
}

/** The sections both pages share, by id; the last one scrolled past is the place. */
const SECTIONS = 'main :is(section, aside, figure, footer)[id]';

export function savePlace(): void {
  let id: string | null = null;
  let offset = 0;
  for (const el of document.querySelectorAll<HTMLElement>(SECTIONS)) {
    const top = el.getBoundingClientRect().top;
    if (top <= 1) {
      id = el.id;
      offset = -top;
    }
  }
  const day = document.querySelector('[data-selected-day]')?.getAttribute('data-selected-day') ?? null;
  set(() => sessionStorage, PLACE_KEY, JSON.stringify({ id, offset, day } satisfies Place));
}

/** The saved place, once: reading it clears it, so a reload starts fresh. */
export function takePlace(): Place | null {
  const raw = get(() => sessionStorage, PLACE_KEY);
  if (raw === null) return null;
  set(() => sessionStorage, PLACE_KEY, null);
  try {
    const p = JSON.parse(raw) as Partial<Place>;
    return {
      id: typeof p.id === 'string' ? p.id : null,
      offset: typeof p.offset === 'number' && Number.isFinite(p.offset) ? p.offset : 0,
      day: typeof p.day === 'string' ? p.day : null,
    };
  } catch {
    return null;
  }
}

/** Scrolls to a saved section, if this page has it. */
export function scrollToPlace(place: Place): void {
  if (place.id === null) return;
  const el = document.getElementById(place.id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + place.offset, behavior: 'instant' });
}
